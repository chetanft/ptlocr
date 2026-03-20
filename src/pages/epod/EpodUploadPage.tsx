import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator, Button } from 'ft-design-system';
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
  const completedSubmissionJobsRef = useRef<Set<string>>(new Set());

  const { processAsync, result, isProcessing, error: processError, progress, reset: resetProcess } = useEpodProcess();
  const isActivelyProcessing = isProcessing || selectionProcessing;

  useEffect(() => {
    if (result) {
      setProcessResult(result);
      setWorkingItems(result.items);
    }
  }, [result]);

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
  }, [isActivelyProcessing, progress.completed, progress.total, uploadMode]);

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
  const selectedProcessItem = useMemo(
    () => workingItems.find((item) => item.id === selectedProcessItemId) ?? null,
    [selectedProcessItemId, workingItems],
  );
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
        if (nextJob.status === 'success') {
          setSubmissionState('submitted_success');
        } else if (nextJob.status === 'failed' || nextJob.status === 'cancelled') {
          setSubmissionState('submitted_failed');
        }
      } catch (error: any) {
        if (!cancelled) {
          setWorkflowError(error?.message || 'Failed to track submission progress');
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

    if (submissionState !== 'submitted_success' && submissionState !== 'submitted_failed') {
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
    setFiles((previous) => previous.filter((file) => file.id !== id));
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
      if (job.status === 'success') {
        setSubmissionState('submitted_success');
      } else if (job.status === 'failed' || job.status === 'cancelled') {
        setSubmissionState('submitted_failed');
      } else {
        setSubmissionState('submitting');
      }
    } catch (error: any) {
      setWorkflowError(error?.message || 'Failed to submit reviewed ePODs');
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
    } catch (error: any) {
      setWorkflowError(error?.message || 'Failed to update workflow');
    }
  };

  const handleSaveOcrEdits = async (ocrPatch: ProcessedOcrPatch) => {
    if (!workflowBatchId || !selectedProcessItemId) {
      return;
    }
    try {
      setWorkflowError(null);
      await syncWorkflow({
        batchId: workflowBatchId,
        itemId: selectedProcessItemId,
        actor,
        actionType: 'ocr-update',
        ocrPatch,
      });
    } catch (error: any) {
      setWorkflowError(error?.message || 'Failed to save OCR edits');
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
    } catch (error: any) {
      setWorkflowError(error?.message || 'Failed to update workflow');
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
    } catch (error: any) {
      setWorkflowError(error?.message || 'Failed to update workflow');
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
    } catch (error: any) {
      setWorkflowError(error?.message || 'Failed to update workflow');
    }
  };

  const footer = (
    <EpodStickyFooter>
      <div className="flex items-center justify-between gap-4">
        <div>
          {currentStep > 0 && !isActivelyProcessing ? (
            <Button
              variant="ghost"
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
      <EpodReviewResultsTable mode="process" items={filteredItems} onView={handleOpenView} />
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
    <div className="flex flex-col" style={{ gap: rem14(40) }}>
      <EpodProgressStepper steps={STEPS} currentStep={currentStep} />

      {processError ? <EpodErrorState message={processError} /> : null}
      {workflowError ? <EpodErrorState message={workflowError} /> : null}

      {currentStep === 0 ? (
        <div className="flex flex-col gap-4">
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
        onSaveOcrEdits={handleSaveOcrEdits}
        onLineReview={handleLineReview}
        onLineOverride={handleLineOverride}
        onResolveException={handleResolveException}
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
      header={<EpodPageHeader title="Upload ePOD images" onBack={() => navigate(-1)} />}
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
