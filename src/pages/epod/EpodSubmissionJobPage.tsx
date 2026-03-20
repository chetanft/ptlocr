import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { useAuth } from '@/auth/AuthContext';
import { getEpodListPathForRole, getEpodUploadPathForRole } from '@/auth/routeUtils';
import { EpodPageHeader } from '@/components/epod/layout/EpodPageHeader';
import { EpodPageShell } from '@/components/epod/layout/EpodPageShell';
import { EpodStickyFooter } from '@/components/epod/layout/EpodStickyFooter';
import { EpodSubmissionResultTable } from '@/components/epod/submission/EpodSubmissionResultTable';
import { EpodErrorState } from '@/components/epod/state/EpodErrorState';
import {
  cancelEpodSubmissionJob,
  getEpodSubmissionJob,
  resubmitEpodSubmissionJob,
  type EpodSubmissionJob,
  type EpodSubmissionJobItem,
} from '@/lib/epodApi';
import { rem14 } from '@/lib/rem';

function JobKpi({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card bordered>
      <CardBody className="flex flex-col" style={{ gap: rem14(8), padding: rem14(16) }}>
        <Typography variant="title-secondary" style={{ color }}>
          {String(value).padStart(2, '0')}
        </Typography>
        <Typography variant="body-primary-medium" color="secondary">
          {label}
        </Typography>
      </CardBody>
    </Card>
  );
}

export default function EpodSubmissionJobPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role ?? 'Transporter';
  const epodListPath = getEpodListPathForRole(role);
  const epodUploadPath = getEpodUploadPathForRole(role);
  const [job, setJob] = useState<EpodSubmissionJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      return;
    }

    let cancelled = false;
    let intervalId: number | null = null;

    const loadJob = async () => {
      try {
        setError(null);
        const nextJob = await getEpodSubmissionJob(jobId);
        if (cancelled) {
          return;
        }
        setJob(nextJob);
        if (nextJob.status !== 'in_progress' && intervalId !== null) {
          window.clearInterval(intervalId);
          intervalId = null;
        }
      } catch (nextError: any) {
        if (!cancelled) {
          setError(nextError?.message || 'Failed to load submission job');
        }
      }
    };

    void loadJob();
    if (job?.status === 'in_progress' || !job) {
      intervalId = window.setInterval(() => {
        void loadJob();
      }, 1000);
    }

    return () => {
      cancelled = true;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [job?.status, jobId]);

  const handleCancelJob = async () => {
    if (!jobId) {
      return;
    }
    try {
      const nextJob = await cancelEpodSubmissionJob(jobId);
      setJob(nextJob);
    } catch (nextError: any) {
      setError(nextError?.message || 'Failed to cancel submission job');
    }
  };

  const handleResubmit = async (itemIds?: string[]) => {
    if (!jobId) {
      return;
    }
    try {
      const nextJob = await resubmitEpodSubmissionJob(jobId, itemIds);
      setJob(nextJob);
    } catch (nextError: any) {
      setError(nextError?.message || 'Failed to re-submit job');
    }
  };

  const handleRetryItem = async (item: EpodSubmissionJobItem) => {
    await handleResubmit([item.id]);
  };

  const breadcrumbs = (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href={epodListPath}>ePOD</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href={epodUploadPath}>Bulk upload ePOD images</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink isCurrentPage>Job ID: {jobId}</BreadcrumbLink>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );

  return (
    <EpodPageShell
      breadcrumbs={breadcrumbs}
      header={<EpodPageHeader title={`Job ID: ${jobId ?? '—'}`} onBack={() => navigate(-1)} />}
      footer={job ? (
        <EpodStickyFooter>
          <div className="flex items-center justify-between gap-4">
            <Button variant="secondary" onClick={handleCancelJob} disabled={job.status !== 'in_progress'}>
              Cancel Job
            </Button>
            <Button variant="primary" onClick={() => void handleResubmit()} disabled={job.failedCount === 0}>
              Re Submit
            </Button>
          </div>
        </EpodStickyFooter>
      ) : undefined}
    >
      <div className="flex flex-col" style={{ gap: rem14(24) }}>
        {error ? <EpodErrorState message={error} /> : null}

        {!job ? (
          <Typography variant="body-primary-regular" color="secondary">
            Loading submission job…
          </Typography>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <JobKpi label="Total files" value={job.totalFiles} color="var(--text-primary)" />
              <JobKpi label="Submitted" value={job.submittedCount} color="var(--semantic-success-600)" />
              <JobKpi label="Failed" value={job.failedCount} color="var(--semantic-danger-600)" />
            </div>

            <EpodSubmissionResultTable
              items={job.items}
              onRetryItem={(item) => void handleRetryItem(item)}
            />
          </>
        )}
      </div>
    </EpodPageShell>
  );
}
