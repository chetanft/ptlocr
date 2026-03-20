import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { getEpodListPathForRole } from '@/auth/routeUtils';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
  Button,
  Typography,
} from 'ft-design-system';
import { EpodProgressStepper } from '@/components/epod/flow/EpodProgressStepper';
import { EpodUploadDropzone } from '@/components/epod/flow/EpodUploadDropzone';
import { EpodUploadedFileList } from '@/components/epod/flow/EpodUploadedFileList';
import { EpodPageHeader } from '@/components/epod/layout/EpodPageHeader';
import { EpodPageShell } from '@/components/epod/layout/EpodPageShell';
import { EpodStickyFooter } from '@/components/epod/layout/EpodStickyFooter';
import { EpodReviewKpiGrid } from '@/components/epod/review/EpodReviewKpiGrid';
import { EpodReviewResultsTable } from '@/components/epod/review/EpodReviewResultsTable';
import { EpodAwbScopeGuard } from '@/components/epod/state/EpodAwbScopeGuard';
import { EpodErrorState } from '@/components/epod/state/EpodErrorState';
import { EpodLoadingState } from '@/components/epod/state/EpodLoadingState';
import { useEpodProcess } from '@/hooks/epod/useEpodProcess';
import type { EpodUploadFile, EpodUploadRouteState, EpodProcessingFilter } from '@/lib/epod/types';
import { rem14 } from '@/lib/rem';

const STEPS = ['Upload Images', 'Process Images', 'Review'] as const;

function createUploadFile(file: File): EpodUploadFile {
  return {
    id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
    file,
    progress: 100,
    status: 'uploaded',
  };
}

export default function EpodUploadPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const routeState = location.state as EpodUploadRouteState | null;
  const selectedShipments = routeState?.selectedShipments ?? [];
  const uploadMode = routeState?.uploadMode ?? (selectedShipments.length > 0 ? 'selection' : 'bulk');
  const epodListPath = getEpodListPathForRole(user?.role ?? 'Transporter');
  const actor = user?.role === 'Ops' ? 'ops' : user?.role === 'Reviewer' ? 'reviewer' : 'transporter';
  const source =
    user?.role === 'Ops'
      ? 'CONSIGNOR_BULK_UPLOAD'
      : user?.role === 'Reviewer'
        ? 'REVIEWER_PORTAL'
        : 'TRANSPORTER_PORTAL';
  const selectedAwbs = useMemo(
    () => selectedShipments.map((s) => s.awbNumber),
    [selectedShipments],
  );

  // ---- State ----
  const [currentStep, setCurrentStep] = useState(0);
  const [files, setFiles] = useState<EpodUploadFile[]>([]);
  const [activeProcessFilter, setActiveProcessFilter] = useState<EpodProcessingFilter>('all');

  // ---- Serverless processing hook ----
  const { processAsync, result, isProcessing, error: processError, reset: resetProcess } = useEpodProcess();

  // ---- Derived data from result ----
  const items = result?.items ?? [];
  const summary = result?.summary ?? null;

  const processCounts = useMemo(() => ({
    matched: items.filter((i) => i.statusLabel === 'Matched').length,
    needsReview: items.filter((i) => i.statusLabel === 'Needs Review').length,
    skipped: items.filter((i) => i.statusLabel === 'Skipped').length,
    unmapped: items.filter((i) => i.statusLabel === 'Unmapped').length,
  }), [items]);

  const filteredItems = useMemo(() => {
    switch (activeProcessFilter) {
      case 'matched': return items.filter((i) => i.statusLabel === 'Matched');
      case 'needsReview': return items.filter((i) => i.statusLabel === 'Needs Review');
      case 'skipped': return items.filter((i) => i.statusLabel === 'Skipped');
      case 'unmapped': return items.filter((i) => i.statusLabel === 'Unmapped');
      default: return items;
    }
  }, [activeProcessFilter, items]);

  const totalAwbCount = uploadMode === 'selection' ? selectedShipments.length : (summary?.totalUploadedImages ?? 0);

  // ---- Handlers ----
  const handleFilesSelected = (selectedFiles: FileList) => {
    const nextFiles = Array.from(selectedFiles).map(createUploadFile);
    setFiles((prev) => [...prev, ...nextFiles]);
  };

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleUploadAndProcess = async () => {
    try {
      setCurrentStep(1);
      await processAsync({
        files: files.map((f) => f.file),
        selectedAwbs,
        source,
        actor,
      });
      // Auto-advance to review when done
      setCurrentStep(2);
    } catch {
      // Error is captured by the hook, stay on step 1
    }
  };

  const handleSubmit = () => {
    // For POC: just navigate back — no server-side submit needed
    navigate(epodListPath);
  };

  // ---- Footer ----
  const footer = (
    <EpodStickyFooter>
      <div className="flex items-center justify-between gap-4">
        <div>
          {currentStep > 0 && !isProcessing ? (
            <Button variant="ghost" onClick={() => { setCurrentStep((p) => Math.max(0, p - 1)); setActiveProcessFilter('all'); }}>
              Previous
            </Button>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => navigate(epodListPath)}>
            Cancel
          </Button>
          {currentStep === 0 ? (
            <Button variant="primary" onClick={handleUploadAndProcess} disabled={files.length === 0} loading={isProcessing}>
              Upload and process
            </Button>
          ) : null}
          {currentStep === 2 ? (
            <Button variant="primary" onClick={handleSubmit} disabled={processCounts.matched === 0}>
              Submit to consignor
            </Button>
          ) : null}
        </div>
      </div>
    </EpodStickyFooter>
  );

  // ---- Render ----
  const content = (
    <div className="flex flex-col" style={{ gap: rem14(40) }}>
      <EpodProgressStepper steps={STEPS} currentStep={currentStep} />

      {processError ? <EpodErrorState message={processError} /> : null}

      {/* Step 0: Upload */}
      {currentStep === 0 ? (
        <div className="flex flex-col gap-4">
          <EpodUploadDropzone onFileSelect={handleFilesSelected} />
          {files.length > 0 ? <EpodUploadedFileList files={files} onRemove={handleRemoveFile} /> : null}
        </div>
      ) : null}

      {/* Step 1: Processing */}
      {currentStep === 1 ? (
        <div className="flex flex-col gap-4">
          {isProcessing ? (
            <EpodLoadingState label={`Processing ${files.length} file${files.length !== 1 ? 's' : ''} with OCR...`} />
          ) : result ? (
            <>
              <EpodReviewKpiGrid
                totalAwbs={totalAwbCount}
                totalUploadedImages={summary?.totalUploadedImages ?? 0}
                matchedCount={processCounts.matched}
                needReviewCount={processCounts.needsReview}
                skippedCount={processCounts.skipped}
                unmappedCount={processCounts.unmapped}
                activeFilter={activeProcessFilter}
                onFilterChange={setActiveProcessFilter}
              />
              <EpodReviewResultsTable items={filteredItems} />
            </>
          ) : null}
        </div>
      ) : null}

      {/* Step 2: Review */}
      {currentStep === 2 ? (
        <div className="flex flex-col gap-4">
          <EpodReviewKpiGrid
            totalAwbs={totalAwbCount}
            totalUploadedImages={summary?.totalUploadedImages ?? 0}
            matchedCount={processCounts.matched}
            needReviewCount={processCounts.needsReview}
            skippedCount={processCounts.skipped}
            unmappedCount={processCounts.unmapped}
            activeFilter={activeProcessFilter}
            onFilterChange={setActiveProcessFilter}
          />
          <EpodReviewResultsTable items={filteredItems} />
        </div>
      ) : null}
    </div>
  );

  return (
    <EpodPageShell
      breadcrumbs={(
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href={epodListPath}>ePOD</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink isCurrentPage>Upload ePOD images</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      )}
      header={(
        <EpodPageHeader title="Upload ePOD images" onBack={() => navigate(-1)} />
      )}
      footer={footer}
    >
      {uploadMode === 'selection' ? (
        <EpodAwbScopeGuard shipments={selectedShipments}>
          {content}
        </EpodAwbScopeGuard>
      ) : content}
    </EpodPageShell>
  );
}
