import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator, Button } from 'ft-design-system';
import { useAuth } from '@/auth/AuthContext';
import { getEpodJobPathForRole, getEpodListPathForRole } from '@/auth/routeUtils';
import { EpodProcessingStageLoader } from '@/components/epod/flow/EpodProcessingStageLoader';
import { EpodProgressStepper } from '@/components/epod/flow/EpodProgressStepper';
import { EpodUploadDropzone } from '@/components/epod/flow/EpodUploadDropzone';
import { EpodUploadedFileList } from '@/components/epod/flow/EpodUploadedFileList';
import { EpodPageHeader } from '@/components/epod/layout/EpodPageHeader';
import { EpodPageShell } from '@/components/epod/layout/EpodPageShell';
import { EpodStickyFooter } from '@/components/epod/layout/EpodStickyFooter';
import { EpodProcessDetailDrawer } from '@/components/epod/process/EpodProcessDetailDrawer';
import { EpodImagePreviewModal, type EpodImagePreview } from '@/components/epod/process/EpodImagePreviewModal';
import { createEpodOcrDraft, type EpodOcrDraft } from '@/components/epod/process/epodOcrDraft';
import { EpodReviewKpiGrid } from '@/components/epod/review/EpodReviewKpiGrid';
import { EpodReviewResultsTable } from '@/components/epod/review/EpodReviewResultsTable';
import { EpodSubmissionStatusScreen } from '@/components/epod/submission/EpodSubmissionStatusScreen';
import { EpodAwbScopeGuard } from '@/components/epod/state/EpodAwbScopeGuard';
import { EpodErrorState } from '@/components/epod/state/EpodErrorState';
import { useEpodProcess } from '@/hooks/epod/useEpodProcess';
import {
  applyEpodWorkflowAction,
  createEpodSubmissionJob,
  createEpodWorkflow,
  getEpodSubmissionJob,
  getReviewFinalMatchStatus,
  type EpodProcessResult,
  type EpodSubmissionJob,
  type ProcessedItem,
  type ProcessedOcrPatch,
} from '@/lib/epodApi';
import { processSelectedAwbFlow } from '@/lib/epod/selectedFlowProcessor';
import { markShipmentsApproved } from '@/lib/epod/shipmentStatusStore';
import type { EpodProcessingFilter, EpodUploadFile, EpodUploadRouteState } from '@/lib/epod/types';
import { rem14 } from '@/lib/rem';

const STEPS = ['Upload Images', 'Process Images', 'Review'] as const;
type SubmissionUiState = 'idle' | 'submitting' | 'submitted_success' | 'submitted_failed';
type PreviewKind = 'image' | 'pdf' | 'other';

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic', 'heif']);

function getSubmissionUiState(job: EpodSubmissionJob): SubmissionUiState {
  if (job.status === 'in_progress') {
    return 'submitting';
  }

  return job.failedCount === 0 ? 'submitted_success' : 'submitted_failed';
}

function normalizeFileName(fileName: string): string {
  return fileName.trim().toLowerCase();
}

function getPreviewKind(file: File): PreviewKind {
  const mimeType = file.type.toLowerCase();
  if (mimeType.startsWith('image/')) {
    return 'image';
  }

  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (IMAGE_EXTENSIONS.has(extension)) {
    return 'image';
  }

  if (extension === 'pdf' || mimeType === 'application/pdf') {
    return 'pdf';
  }

  return 'other';
}

function createUploadFile(file: File): EpodUploadFile {
  const previewKind = getPreviewKind(file);
  const isImage = previewKind === 'image';
  return {
    id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
    file,
    progress: 100,
    status: 'uploaded',
    previewKind,
    previewUrl: isImage ? URL.createObjectURL(file) : undefined,
    normalizedFileName: normalizeFileName(file.name),
  };
}

export default function EpodUploadPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const routeState = location.state as EpodUploadRouteState | null;
  const selectedShipments = useMemo(() => routeState?.selectedShipments ?? [], [routeState]);
  const uploadMode = routeState?.uploadMode ?? (selectedShipments.length > 0 ? 'selection' : 'bulk');
  const epodListPath = getEpodListPathForRole(user?.role ?? 'Transporter');
  const actor = user?.role === 'Ops' ? 'ops' : user?.role === 'Reviewer' ? 'reviewer' : 'transporter';
  const source =
    user?.role === 'Ops'
      ? 'CONSIGNOR_BULK_UPLOAD'
      : user?.role === 'Reviewer'
        ? 'REVIEWER_PORTAL'
        : 'TRANSPORTER_PORTAL';
  const selectedAwbs = useMemo(() => selectedShipments.map((shipment) => shipment.awbNumber), [selectedShipments]);
  const epodJobPath = (jobId: string) => getEpodJobPathForRole(user?.role ?? 'Transporter', jobId);

  const [currentStep, setCurrentStep] = useState(0);
  const [files, setFiles] = useState<EpodUploadFile[]>([]);
  const [activeProcessFilter, setActiveProcessFilter] = useState<EpodProcessingFilter>('all');
  const [workingItems, setWorkingItems] = useState<ProcessedItem[]>([]);
  const [selectedProcessItemId, setSelectedProcessItemId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [workflowBatchId, setWorkflowBatchId] = useState<string | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [processResult, setProcessResult] = useState<EpodProcessResult | null>(null);
  const [selectionProcessing, setSelectionProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState(0);
  const [submissionState, setSubmissionState] = useState<SubmissionUiState>('idle');
  const [submissionJob, setSubmissionJob] = useState<EpodSubmissionJob | null>(null);
  const [imagePreview, setImagePreview] = useState<EpodImagePreview | null>(null);
  const [imagePreviewDraft, setImagePreviewDraft] = useState<EpodOcrDraft | null>(null);
  const [isSavingImagePreviewDraft, setIsSavingImagePreviewDraft] = useState(false);
  const completedSubmissionJobsRef = useRef<Set<string>>(new Set());
  const filesRef = useRef<EpodUploadFile[]>([]);

  const { processAsync, result, isProcessing, error: processError, progress, reset: resetProcess } = useEpodProcess();
  const isActivelyProcessing = isProcessing || selectionProcessing;

  useEffect(() => {
    if (result) {
      setProcessResult(result);
      setWorkingItems(result.items);
    }
  }, [result]);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    return () => {
      for (const file of filesRef.current) {
        if (file.previewUrl) {
          URL.revokeObjectURL(file.previewUrl);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!isActivelyProcessing) {
      setProcessingStage(0);
      return;
    }

    let tick = 0;
    const interval = window.setInterval(() => {
      tick += 1;
      setProcessingStage((previous) => {
        let nextStage: number;

        if (uploadMode === 'selection') {
          // Selection mode: simulate stages with timer
          nextStage = Math.min(3, Math.floor(tick / 1.1));
        } else {
          // Bulk mode: use actual stage from backend progress
          nextStage = progress.stage ?? 0;
        }

        // Never go backwards — once a step is reached, keep it
        return Math.max(previous, nextStage);
      });
    }, 700);

    return () => window.clearInterval(interval);
  }, [isActivelyProcessing, progress.completed, progress.stage, progress.total, uploadMode]);

  const previewLookup = useMemo(() => {
    const lookup = new Map<string, EpodUploadFile[]>();

    for (const file of files) {
      const key = file.normalizedFileName ?? normalizeFileName(file.file.name);
      const existing = lookup.get(key) ?? [];
      existing.push(file);
      lookup.set(key, existing);
    }

    return lookup;
  }, [files]);

  const resolvePreviewForFileName = useCallback((fileName: string): EpodImagePreview | null => {
    const matches = previewLookup.get(normalizeFileName(fileName));
    const previewFile = matches?.find((file) => file.previewKind === 'image' && Boolean(file.previewUrl));

    if (!previewFile || !previewFile.previewUrl) {
      return null;
    }

    return {
      fileName: previewFile.file.name,
      previewUrl: previewFile.previewUrl,
      previewKind: previewFile.previewKind ?? 'other',
    };
  }, [previewLookup]);

  const openImagePreview = (preview: EpodImagePreview, item?: ProcessedItem | null) => {
    if (preview.previewKind !== 'image') {
      return;
    }

    if (item) {
      setSelectedProcessItemId(item.id);
    }
    setImagePreview(preview);
  };

  const openImagePreviewForFileName = (fileName: string, item?: ProcessedItem | null) => {
    const preview = resolvePreviewForFileName(fileName);
    if (preview) {
      openImagePreview(preview, item);
    }
  };

  const handlePreviewItem = (item: ProcessedItem) => {
    openImagePreviewForFileName(item.fileName, item);
  };

  const processCounts = useMemo(
    () => ({
      matched: workingItems.filter((item) => item.statusLabel === 'Matched').length,
      needsReview: workingItems.filter((item) => item.statusLabel === 'Needs Review').length,
      skipped: workingItems.filter((item) => item.statusLabel === 'Skipped').length,
      unmapped: workingItems.filter((item) => item.statusLabel === 'Unmapped').length,
    }),
    [workingItems],
  );

  const filteredItems = useMemo(() => {
    switch (activeProcessFilter) {
      case 'matched':
        return workingItems.filter((item) => item.statusLabel === 'Matched');
      case 'needsReview':
        return workingItems.filter((item) => item.statusLabel === 'Needs Review');
      case 'skipped':
        return workingItems.filter((item) => item.statusLabel === 'Skipped');
      case 'unmapped':
        return workingItems.filter((item) => item.statusLabel === 'Unmapped');
      default:
        return workingItems;
    }
  }, [activeProcessFilter, workingItems]);

  const totalAwbCount = uploadMode === 'selection' ? selectedShipments.length : (processResult?.summary.totalAwbs ?? 0);
  const selectedAwbBadgeLabel =
    uploadMode === 'selection'
      ? `${selectedShipments.length} AWB${selectedShipments.length === 1 ? '' : 's'} selected`
      : null;
  const selectedProcessItem = useMemo(
    () => workingItems.find((item) => item.id === selectedProcessItemId) ?? null,
    [selectedProcessItemId, workingItems],
  );
  const selectedProcessPreview = useMemo(
    () => (selectedProcessItem ? resolvePreviewForFileName(selectedProcessItem.fileName) : null),
    [resolvePreviewForFileName, selectedProcessItem],
  );
  useEffect(() => {
    if (!imagePreview || !selectedProcessItem) {
      setImagePreviewDraft(null);
      return;
    }

    setImagePreviewDraft(createEpodOcrDraft(selectedProcessItem));
  }, [imagePreview, selectedProcessItem]);
  const reviewItems = useMemo(
    () => workingItems.filter((item) => item.statusLabel !== 'Unmapped'),
    [workingItems],
  );
  const reviewCounts = useMemo(() => {
    const summary = { matched: 0, manuallyMatched: 0, skipped: 0 };
    for (const item of reviewItems) {
      const status = getReviewFinalMatchStatus(item);
      if (status === 'matched') summary.matched += 1;
      else if (status === 'manually_matched') summary.manuallyMatched += 1;
      else summary.skipped += 1;
    }
    return summary;
  }, [reviewItems]);
  const filteredReviewItems = useMemo(() => {
    switch (activeProcessFilter) {
      case 'matched':
        return reviewItems.filter((item) => getReviewFinalMatchStatus(item) === 'matched');
      case 'needsReview':
        return reviewItems.filter((item) => getReviewFinalMatchStatus(item) === 'manually_matched');
      case 'skipped':
        return reviewItems.filter((item) => getReviewFinalMatchStatus(item) === 'skipped');
      default:
        return reviewItems;
    }
  }, [activeProcessFilter, reviewItems]);

  useEffect(() => {
    if (submissionState !== 'submitting' || !submissionJob?.jobId) {
      return;
    }

    let cancelled = false;
    const intervalId = window.setInterval(async () => {
      try {
        const nextJob = await getEpodSubmissionJob(submissionJob.jobId);
        if (cancelled) {
          return;
        }
        setSubmissionJob(nextJob);
        if (nextJob.status !== 'in_progress') {
          setSubmissionState(getSubmissionUiState(nextJob));
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setWorkflowError(error instanceof Error ? error.message : 'Failed to track submission progress');
        }
      }
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [submissionJob?.jobId, submissionState]);

  useEffect(() => {
    if (!submissionJob?.jobId) {
      return;
    }

    if (submissionState !== 'submitted_success') {
      return;
    }

    if (completedSubmissionJobsRef.current.has(submissionJob.jobId)) {
      return;
    }

    completedSubmissionJobsRef.current.add(submissionJob.jobId);
    markShipmentsApproved(
      submissionJob.items
        .filter((item) => item.status === 'Submitted')
        .map((item) => item.awbNumber),
    );
  }, [submissionJob, submissionState]);

  const handleFilesSelected = (selectedFiles: FileList) => {
    const nextFiles = Array.from(selectedFiles).map(createUploadFile);
    setFiles((previous) => [...previous, ...nextFiles]);
  };

  const handleRemoveFile = (id: string) => {
    const removedFile = files.find((file) => file.id === id) ?? null;
    setFiles((previous) => previous.filter((file) => file.id !== id));

    if (removedFile?.previewUrl) {
      URL.revokeObjectURL(removedFile.previewUrl);
    }

    if (imagePreview?.previewUrl === removedFile?.previewUrl) {
      setImagePreview(null);
      setImagePreviewDraft(null);
    }
  };

  const handleUploadAndProcess = async () => {
    try {
      setCurrentStep(1);
      setActiveProcessFilter('all');
      setWorkflowError(null);
      resetProcess();
      setProcessResult(null);
      setWorkingItems([]);
      setWorkflowBatchId(null);

      const nextProcessResult =
        uploadMode === 'selection'
          ? await (async () => {
              setSelectionProcessing(true);
              try {
                return await processSelectedAwbFlow({
                  files: files.map((file) => file.file),
                  selectedShipments,
                  actor,
                  delayMs: 3000,
                });
              } finally {
                setSelectionProcessing(false);
              }
            })()
          : await processAsync({
              files: files.map((file) => file.file),
              selectedAwbs,
              source,
              actor,
            });

      setProcessResult(nextProcessResult);
      const workflow = await createEpodWorkflow(nextProcessResult);
      setWorkflowBatchId(workflow.batchId);
      setWorkingItems(workflow.items);
    } catch {
      // Hook already captures and surfaces the error message.
      setSelectionProcessing(false);
    }
  };

  const handleSubmit = async () => {
    if (!workflowBatchId) {
      return;
    }

    try {
      setWorkflowError(null);
      const itemIds = reviewItems
        .filter((item) => getReviewFinalMatchStatus(item) !== 'skipped')
        .map((item) => item.id);
      const job = await createEpodSubmissionJob({
        batchId: workflowBatchId,
        actor,
        itemIds,
      });
      setSubmissionJob(job);
      setSubmissionState(getSubmissionUiState(job));
    } catch (error: unknown) {
      setWorkflowError(error instanceof Error ? error.message : 'Failed to submit reviewed ePODs');
    }
  };

  const handleOpenView = (item: ProcessedItem) => {
    setSelectedProcessItemId(item.id);
    setDrawerOpen(true);
  };

  const syncWorkflow = async (payload: Parameters<typeof applyEpodWorkflowAction>[0]) => {
    const workflow = await applyEpodWorkflowAction(payload);
    setWorkingItems(workflow.items);
    setWorkflowBatchId(workflow.batchId);
  };

  const handleDocumentAction = async (action: 'reject' | 'sendToReviewer' | 'approve') => {
    if (!workflowBatchId || !selectedProcessItemId) {
      return;
    }
    try {
      setWorkflowError(null);
      await syncWorkflow({
        batchId: workflowBatchId,
        itemId: selectedProcessItemId,
        actor,
        actionType: 'document',
        documentAction: action,
      });
    } catch (error: unknown) {
      setWorkflowError(error instanceof Error ? error.message : 'Failed to update workflow');
    }
  };

  const handleSaveOcrEditsForItem = async (itemId: string, ocrPatch: ProcessedOcrPatch) => {
    if (!workflowBatchId) {
      return;
    }
    try {
      setWorkflowError(null);
      await syncWorkflow({
        batchId: workflowBatchId,
        itemId,
        actor,
        actionType: 'ocr-update',
        ocrPatch,
      });
    } catch (error: unknown) {
      setWorkflowError(error instanceof Error ? error.message : 'Failed to save OCR edits');
      throw error;
    }
  };

  const handleSaveImagePreviewDraft = async () => {
    if (!selectedProcessItemId || !imagePreviewDraft) {
      return;
    }

    try {
      setIsSavingImagePreviewDraft(true);
      await handleSaveOcrEditsForItem(selectedProcessItemId, imagePreviewDraft);
    } finally {
      setIsSavingImagePreviewDraft(false);
    }
  };

  const handleLineReview = async (lineId: string, reviewAction: 'ACCEPTED' | 'REJECTED') => {
    if (!workflowBatchId || !selectedProcessItemId) {
      return;
    }
    try {
      setWorkflowError(null);
      await syncWorkflow({
        batchId: workflowBatchId,
        itemId: selectedProcessItemId,
        actor,
        actionType: 'line-review',
        lineId,
        reviewAction,
      });
    } catch (error: unknown) {
      setWorkflowError(error instanceof Error ? error.message : 'Failed to update workflow');
    }
  };

  const handleLineOverride = async (lineId: string) => {
    if (!workflowBatchId || !selectedProcessItemId) {
      return;
    }
    try {
      setWorkflowError(null);
      await syncWorkflow({
        batchId: workflowBatchId,
        itemId: selectedProcessItemId,
        actor,
        actionType: 'line-override',
        lineId,
      });
    } catch (error: unknown) {
      setWorkflowError(error instanceof Error ? error.message : 'Failed to update workflow');
    }
  };

  const handleResolveException = async (exceptionId: string) => {
    if (!workflowBatchId || !selectedProcessItemId) {
      return;
    }
    try {
      setWorkflowError(null);
      await syncWorkflow({
        batchId: workflowBatchId,
        itemId: selectedProcessItemId,
        actor,
        actionType: 'exception-resolve',
        exceptionId,
      });
    } catch (error: unknown) {
      setWorkflowError(error instanceof Error ? error.message : 'Failed to update workflow');
    }
  };

  const footer = (
    <EpodStickyFooter>
      <div className="flex items-center justify-between gap-4">
        <div>
          {currentStep > 0 && !isActivelyProcessing ? (
            <Button
              variant="text"
              onClick={() => {
                setCurrentStep((previous) => Math.max(0, previous - 1));
                setActiveProcessFilter('all');
              }}
            >
              Previous
            </Button>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => navigate(epodListPath)}>
            Cancel
          </Button>
          {currentStep === 0 ? (
            <Button variant="primary" onClick={handleUploadAndProcess} disabled={files.length === 0} loading={isActivelyProcessing}>
              Upload and process
            </Button>
          ) : null}
          {currentStep === 1 && processResult ? (
            <Button
              variant="primary"
              onClick={() => {
                setCurrentStep(2);
                setActiveProcessFilter('all');
              }}
            >
              Next
            </Button>
          ) : null}
          {currentStep === 2 && processResult ? (
            <Button variant="primary" onClick={() => void handleSubmit()} disabled={reviewCounts.matched + reviewCounts.manuallyMatched === 0}>
              Submit
            </Button>
          ) : null}
        </div>
      </div>
    </EpodStickyFooter>
  );

  const resultSurface = processResult ? (
    <>
      <EpodReviewKpiGrid
        mode="process"
        totalAwbs={totalAwbCount}
        totalUploadedImages={processResult.summary.totalUploadedImages}
        matchedCount={processCounts.matched}
        needReviewCount={processCounts.needsReview}
        skippedCount={processCounts.skipped}
        unmappedCount={processCounts.unmapped}
        activeFilter={activeProcessFilter}
        onFilterChange={setActiveProcessFilter}
      />
      <EpodReviewResultsTable mode="process" items={filteredItems} onView={handleOpenView} onPreview={handlePreviewItem} />
    </>
  ) : null;
  const reviewSurface = processResult ? (
    <>
      <EpodReviewKpiGrid
        mode="review"
        totalAwbs={reviewItems.length}
        totalUploadedImages={reviewItems.length}
        matchedCount={reviewCounts.matched}
        needReviewCount={reviewCounts.manuallyMatched}
        skippedCount={reviewCounts.skipped}
        unmappedCount={0}
        activeFilter={activeProcessFilter}
        onFilterChange={setActiveProcessFilter}
      />
      <EpodReviewResultsTable mode="review" items={filteredReviewItems} onView={handleOpenView} />
    </>
  ) : null;

  if (submissionState !== 'idle' && submissionJob) {
    return (
      <EpodPageShell header={<></>}>
        <EpodSubmissionStatusScreen
          status={submissionState === 'submitting' ? 'in_progress' : submissionState === 'submitted_success' ? 'success' : 'failed'}
          totalFiles={submissionJob.totalFiles}
          submittedCount={submissionJob.submittedCount}
          failedCount={submissionJob.failedCount}
          subtitle={submissionState === 'submitting' ? 'This may take a few moments.' : undefined}
          primaryActionLabel={submissionState === 'submitted_success' ? 'Go to Job page' : 'Go to Job page'}
          secondaryActionLabel={
            submissionState === 'submitting'
              ? 'Minimize to ePOD'
              : submissionState === 'submitted_success'
                ? 'Go to ePOD'
                : undefined
          }
          onPrimaryAction={() => navigate(epodJobPath(submissionJob.jobId))}
          onSecondaryAction={
            submissionState === 'submitting'
              ? () => navigate(epodListPath)
              : submissionState === 'submitted_success'
                ? () => navigate(epodListPath)
                : undefined
          }
        />
      </EpodPageShell>
    );
  }

  const content = (
    <div className="flex flex-col" style={{ gap: rem14(64) }}>
      <EpodProgressStepper steps={STEPS} currentStep={currentStep} />

      {processError ? <EpodErrorState message={processError} /> : null}
      {workflowError ? <EpodErrorState message={workflowError} /> : null}

      {currentStep === 0 ? (
        <div className="flex min-h-0 flex-col gap-4" style={{ minHeight: rem14(220) }}>
          <EpodUploadDropzone onFileSelect={handleFilesSelected} />
          {files.length > 0 ? <EpodUploadedFileList files={files} onRemove={handleRemoveFile} /> : null}
        </div>
      ) : null}

      {currentStep === 1 ? (
        <div className="flex flex-col gap-4">
          {isActivelyProcessing ? (
            <EpodProcessingStageLoader
              activeStage={processingStage}
              completedFiles={progress.completed}
              totalFiles={progress.total || files.length}
              mode={uploadMode}
            />
          ) : resultSurface}
        </div>
      ) : null}

      {currentStep === 2 ? <div className="flex flex-col gap-4">{reviewSurface}</div> : null}

      <EpodProcessDetailDrawer
        item={selectedProcessItem}
        open={drawerOpen}
        role={user?.role ?? 'Transporter'}
        onOpenChange={setDrawerOpen}
        onDocumentAction={handleDocumentAction}
        onLineReview={handleLineReview}
        onLineOverride={handleLineOverride}
        onResolveException={handleResolveException}
        onSaveOcrEdits={(ocrPatch) => (selectedProcessItem ? handleSaveOcrEditsForItem(selectedProcessItem.id, ocrPatch) : undefined)}
        previewUrl={selectedProcessPreview?.previewUrl ?? null}
        canPreview={Boolean(selectedProcessPreview?.previewUrl)}
        onPreview={selectedProcessItem ? () => openImagePreviewForFileName(selectedProcessItem.fileName, selectedProcessItem) : undefined}
      />
      <EpodImagePreviewModal
        open={Boolean(imagePreview)}
        item={selectedProcessItem}
        preview={imagePreview}
        role={user?.role ?? 'Transporter'}
        draft={imagePreviewDraft}
        onDraftChange={setImagePreviewDraft}
        onSaveOcrEdits={handleSaveImagePreviewDraft}
        isSaving={isSavingImagePreviewDraft}
        errorMessage={workflowError}
        onOpenChange={(open) => {
          if (!open) {
            setImagePreview(null);
            setImagePreviewDraft(null);
          }
        }}
      />
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
        <EpodPageHeader
          title={(
            <span className="inline-flex flex-wrap items-center gap-3">
              <span>Upload ePOD images</span>
              {selectedAwbBadgeLabel ? <Badge variant="secondary">{selectedAwbBadgeLabel}</Badge> : null}
            </span>
          )}
          onBack={() => navigate(-1)}
        />
      )}
      footer={footer}
    >
      {uploadMode === 'selection' ? (
        <EpodAwbScopeGuard shipments={selectedShipments}>{content}</EpodAwbScopeGuard>
      ) : (
        content
      )}
    </EpodPageShell>
  );
}
