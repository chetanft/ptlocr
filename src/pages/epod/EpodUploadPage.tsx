import { useEffect, useMemo, useState } from 'react';
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
  Card,
  CardBody,
  Typography,
} from 'ft-design-system';
import { EpodBatchSummaryCards } from '@/components/epod/flow/EpodBatchSummaryCards';
import { EpodCancelBatchModal } from '@/components/epod/flow/EpodCancelBatchModal';
import { EpodProcessingTimeline } from '@/components/epod/flow/EpodProcessingTimeline';
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
import { useEpodBatchUpload } from '@/hooks/epod/useEpodBatchUpload';
import { useEpodBatch } from '@/hooks/epod/useEpodBatchProcessing';
import { useEpodReview } from '@/hooks/epod/useEpodReview';
import type {
  EpodProcessedDisplayRow,
  EpodProcessingFilter,
  EpodUploadFile,
  EpodUploadRouteState,
} from '@/lib/epod/types';
import { buildProcessedDisplayRows } from '@/lib/epod/mappers';
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
    () => selectedShipments.map((shipment) => shipment.awbNumber),
    [selectedShipments],
  );

  const [currentStep, setCurrentStep] = useState(0);
  const [files, setFiles] = useState<EpodUploadFile[]>([]);
  const [batchId, setBatchId] = useState<string>();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeProcessFilter, setActiveProcessFilter] = useState<EpodProcessingFilter>('all');

  const { createBatchMutation, uploadFilesMutation } = useEpodBatchUpload();
  const {
    batchQuery,
    itemsQuery,
    processMutation,
    submitMutation,
    cancelMutation,
  } = useEpodBatch(batchId);

  const batch = batchQuery.data;
  const items = itemsQuery.data ?? [];
  const reviewGroups = useEpodReview(items);
  const isBatchReadyForReview =
    batch?.status === 'REVIEW_REQUIRED' ||
    batch?.status === 'READY_TO_SUBMIT' ||
    batch?.status === 'SUBMITTED';
  const totalAwbCount =
    uploadMode === 'selection'
      ? selectedShipments.length
      : (batch?.matchedCount ?? 0);
  const reviewTableItems = useMemo(
    () => [
      ...reviewGroups.ready,
      ...reviewGroups.review,
      ...reviewGroups.blocked,
      ...reviewGroups.unmapped,
    ],
    [reviewGroups.blocked, reviewGroups.ready, reviewGroups.review, reviewGroups.unmapped],
  );
  const processedDisplayRows = useMemo(
    () => buildProcessedDisplayRows(reviewTableItems, selectedShipments),
    [reviewTableItems, selectedShipments],
  );
  const processCounts = useMemo(
    () => ({
      matched: processedDisplayRows.filter((row) => row.statusLabel === 'Matched').length,
      needsReview: processedDisplayRows.filter((row) => row.statusLabel === 'Needs Review').length,
      skipped: processedDisplayRows.filter((row) => row.statusLabel === 'Skipped').length,
      unmapped: processedDisplayRows.filter((row) => row.statusLabel === 'Unmapped').length,
    }),
    [processedDisplayRows],
  );
  const filteredProcessRows = useMemo(() => {
    switch (activeProcessFilter) {
      case 'matched':
        return processedDisplayRows.filter((row) => row.statusLabel === 'Matched');
      case 'needsReview':
        return processedDisplayRows.filter((row) => row.statusLabel === 'Needs Review');
      case 'skipped':
        return processedDisplayRows.filter((row) => row.statusLabel === 'Skipped');
      case 'unmapped':
        return processedDisplayRows.filter((row) => row.statusLabel === 'Unmapped');
      default:
        return processedDisplayRows;
    }
  }, [activeProcessFilter, processedDisplayRows]);

  useEffect(() => {
    if (!batch) return;
    if (batch.status === 'OCR_PROCESSING' || batch.status === 'MATCHING') {
      setCurrentStep(1);
    }
  }, [batch]);

  useEffect(() => {
    setActiveProcessFilter('all');
  }, [currentStep, batchId]);

  const handleFilesSelected = (selectedFiles: FileList) => {
    const nextFiles = Array.from(selectedFiles).map(createUploadFile);
    setFiles((previous) => [...previous, ...nextFiles]);
  };

  const handleRemoveFile = (id: string) => {
    setFiles((previous) => previous.filter((file) => file.id !== id));
  };

  const handleStartBatch = async () => {
    try {
      setError(null);

      const batchJob = batchId
        ? { id: batchId }
        : await createBatchMutation.mutateAsync({
            selectedAwbs,
            source,
            createdBy: actor,
          });

      const nextBatchId = batchJob.id;
      setBatchId(nextBatchId);

      await uploadFilesMutation.mutateAsync({
        batchId: nextBatchId,
        files: files.map((file) => file.file),
        source,
        uploadedBy: actor,
      });

      await processMutation.mutateAsync(nextBatchId);
      setCurrentStep(1);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to upload ePOD files');
    }
  };

  const handleSubmitBatch = async () => {
    if (!batchId) return;

    try {
      setError(null);
      await submitMutation.mutateAsync(actor);
      await Promise.all([batchQuery.refetch(), itemsQuery.refetch()]);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to submit batch');
    }
  };

  const handleCancelBatch = async () => {
    if (!batchId) {
      navigate(epodListPath);
      return;
    }

    try {
      await cancelMutation.mutateAsync();
      await batchQuery.refetch();
      setShowCancelModal(false);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to cancel batch');
    }
  };

  const footer = (
    <EpodStickyFooter>
      <div className="flex items-center justify-between gap-4">
        <div>
          {currentStep > 0 ? (
            <Button variant="ghost" onClick={() => setCurrentStep((previous) => Math.max(0, previous - 1))}>
              Previous
            </Button>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => (batchId ? setShowCancelModal(true) : navigate(epodListPath))}>
            Cancel
          </Button>
          {currentStep === 0 ? (
            <Button variant="primary" onClick={handleStartBatch} disabled={files.length === 0 || createBatchMutation.isPending || uploadFilesMutation.isPending}>
              Upload and process
            </Button>
          ) : null}
          {currentStep === 1 ? (
            <Button
              variant="primary"
              onClick={() => setCurrentStep(2)}
              disabled={!isBatchReadyForReview}
            >
              Next
            </Button>
          ) : null}
          {currentStep === 2 ? (
            <Button variant="primary" onClick={handleSubmitBatch} disabled={processCounts.matched === 0} loading={submitMutation.isPending}>
              Submit to consignor
            </Button>
          ) : null}
        </div>
      </div>
    </EpodStickyFooter>
  );

  return (
    <>
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
          <EpodPageHeader
            title="Upload ePOD images"
            onBack={() => navigate(-1)}
          />
        )}
        footer={footer}
      >
        {uploadMode === 'selection' ? (
          <EpodAwbScopeGuard shipments={selectedShipments}>
            <div className="flex flex-col" style={{ gap: rem14(40) }}>
              <EpodProgressStepper steps={STEPS} currentStep={currentStep} />

              {error ? <EpodErrorState message={error} /> : null}

              {currentStep === 0 ? (
                <div className="flex flex-col gap-4">
                  <EpodUploadDropzone onFileSelect={handleFilesSelected} />
                  {files.length > 0 ? <EpodUploadedFileList files={files} onRemove={handleRemoveFile} /> : null}
                </div>
              ) : null}

              {currentStep === 1 ? (
                <div className="flex flex-col gap-4">
                  {!isBatchReadyForReview ? (
                    <>
                      {batch ? <EpodBatchSummaryCards batch={batch} /> : <EpodLoadingState label="Loading batch summary..." />}
                      {batchQuery.isLoading ? (
                        <EpodLoadingState label="Preparing OCR batch..." />
                      ) : (
                        <Card bordered>
                          <CardBody>
                            <div className="flex flex-col gap-3">
                              <Typography variant="display-primary" color="primary">
                                Processing selected AWBs
                              </Typography>
                              <EpodProcessingTimeline batch={batch} />
                            </div>
                          </CardBody>
                        </Card>
                      )}
                    </>
                  ) : (
                    <>
                      <EpodReviewKpiGrid
                        totalAwbs={totalAwbCount}
                        totalUploadedImages={items.length}
                        matchedCount={processCounts.matched}
                        needReviewCount={processCounts.needsReview}
                        skippedCount={processCounts.skipped}
                        unmappedCount={processCounts.unmapped}
                        activeFilter={activeProcessFilter}
                        onFilterChange={setActiveProcessFilter}
                      />
                      <Card bordered>
                        <CardBody>
                          <EpodReviewResultsTable
                            items={filteredProcessRows}
                          />
                        </CardBody>
                      </Card>
                    </>
                  )}
                </div>
              ) : null}

              {currentStep === 2 ? (
                batch && itemsQuery.isLoading ? (
                  <EpodLoadingState label="Loading review buckets..." />
                ) : batch ? (
                  <div className="flex flex-col gap-4">
                    <EpodReviewKpiGrid
                      totalAwbs={totalAwbCount}
                      totalUploadedImages={items.length}
                      matchedCount={processCounts.matched}
                      needReviewCount={processCounts.needsReview}
                      skippedCount={processCounts.skipped}
                      unmappedCount={processCounts.unmapped}
                      activeFilter={activeProcessFilter}
                      onFilterChange={setActiveProcessFilter}
                    />
                    <Card bordered>
                      <CardBody>
                        <EpodReviewResultsTable
                          items={filteredProcessRows}
                        />
                      </CardBody>
                    </Card>
                  </div>
                ) : (
                  <EpodLoadingState label="Waiting for review results..." />
                )
              ) : null}
            </div>
          </EpodAwbScopeGuard>
        ) : (
          <div className="flex flex-col" style={{ gap: rem14(40) }}>
            <EpodProgressStepper steps={STEPS} currentStep={currentStep} />

            {error ? <EpodErrorState message={error} /> : null}

            {currentStep === 0 ? (
              <div className="flex flex-col gap-4">
                <EpodUploadDropzone onFileSelect={handleFilesSelected} />
                {files.length > 0 ? <EpodUploadedFileList files={files} onRemove={handleRemoveFile} /> : null}
              </div>
            ) : null}

            {currentStep === 1 ? (
              <div className="flex flex-col gap-4">
                {!isBatchReadyForReview ? (
                  <>
                    {batch ? <EpodBatchSummaryCards batch={batch} /> : <EpodLoadingState label="Loading batch summary..." />}
                    {batchQuery.isLoading ? (
                      <EpodLoadingState label="Preparing OCR batch..." />
                    ) : (
                      <Card bordered>
                        <CardBody>
                          <div className="flex flex-col gap-3">
                            <Typography variant="display-primary" color="primary">
                              Processing selected AWBs
                            </Typography>
                            <EpodProcessingTimeline batch={batch} />
                          </div>
                        </CardBody>
                      </Card>
                    )}
                  </>
                ) : (
                  <>
                    <EpodReviewKpiGrid
                      totalAwbs={totalAwbCount}
                      totalUploadedImages={items.length}
                      matchedCount={processCounts.matched}
                      needReviewCount={processCounts.needsReview}
                      skippedCount={processCounts.skipped}
                      unmappedCount={processCounts.unmapped}
                      activeFilter={activeProcessFilter}
                      onFilterChange={setActiveProcessFilter}
                    />
                    <EpodReviewResultsTable
                      items={filteredProcessRows}
                    />
                  </>
                )}
              </div>
            ) : null}

            {currentStep === 2 ? (
              batch && itemsQuery.isLoading ? (
                <EpodLoadingState label="Loading review buckets..." />
                ) : batch ? (
                  <div className="flex flex-col gap-4">
                    <EpodReviewKpiGrid
                      totalAwbs={totalAwbCount}
                      totalUploadedImages={items.length}
                      matchedCount={processCounts.matched}
                      needReviewCount={processCounts.needsReview}
                      skippedCount={processCounts.skipped}
                      unmappedCount={processCounts.unmapped}
                      activeFilter={activeProcessFilter}
                      onFilterChange={setActiveProcessFilter}
                    />
                    <EpodReviewResultsTable
                      items={filteredProcessRows}
                    />
                </div>
              ) : (
                <EpodLoadingState label="Waiting for review results..." />
              )
            ) : null}
          </div>
        )}
      </EpodPageShell>

      <EpodCancelBatchModal
        open={showCancelModal}
        onOpenChange={setShowCancelModal}
        batch={batch}
        onConfirm={handleCancelBatch}
        loading={cancelMutation.isPending}
      />
    </>
  );
}
