import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Button,
    Badge,
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
    Steps,
    StepsList,
    StepItem,
    StepTitle,
    Modal,
    ModalContent,
    ModalHeader,
    ModalTitle,
    ModalBody,
    ModalFooter,
    Input,
    InputLabel,
    InputField,
    Textarea,
    TextareaLabel,
    TextareaField,
    Alert,
    AlertDescription,
    Descriptions,
    DescriptionsItem,
    Typography,
    Icon,
    Loader,
} from 'ft-design-system';
import {
    getPodDetail,
    reconcilePod,
    processOcr,
    reviewLine as reviewLineApi,
    resolveException as resolveExceptionApi,
    approvePod,
    rejectPod,
} from '@/lib/podApi';
import { PodStatusBadge } from '@/components/pod/PodStatusBadge';
import { ExceptionBadge } from '@/components/pod/ExceptionBadge';
import { PodImageViewer } from '@/components/pod/PodImageViewer';
import { ReconLineTable } from '@/components/pod/ReconLineTable';
import { getEpodListPathForRole } from '@/auth/routeUtils';
import { rem14 } from '@/lib/rem';

const STEPS = ['Upload', 'OCR', 'Reconciliation', 'Review', 'Approved'];

function getStepIndex(status: string): number {
    switch (status) {
        case 'UPLOADED': return 0;
        case 'PROCESSING': return 1;
        case 'PROCESSED': return 2;
        case 'REVIEW': return 3;
        case 'SUBMITTED': return 4;
        case 'APPROVED':
        case 'REJECTED': return 4;
        default: return 0;
    }
}

export default function PodReviewPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('ocr');
    const [showRawJson, setShowRawJson] = useState(false);
    const [overrideModal, setOverrideModal] = useState<any | null>(null);
    const [overrideQty, setOverrideQty] = useState('');
    const [overrideDamaged, setOverrideDamaged] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [approveComment, setApproveComment] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectComment, setRejectComment] = useState('');

    const podQuery = useQuery({
        queryKey: ['pod-detail', id],
        queryFn: () => getPodDetail(id!),
        enabled: !!id,
    });

    const pod = podQuery.data;
    const ocrResult = pod?.ocrResult;
    const lineRecons = pod?.lineRecons || [];
    const exceptions = pod?.exceptions || [];
    const approvals = pod?.approvals || [];
    const currentStep = pod ? getStepIndex(pod.status) : 0;
    const actor = user?.role === 'Reviewer' ? 'reviewer' : user?.role === 'Transporter' ? 'transporter' : 'ops';
    const backPath = getEpodListPathForRole(user?.role ?? 'Transporter');
    const approveLabel = user?.role === 'Reviewer' ? 'Approve POD' : 'Submit to Reviewer';
    const isTransporter = user?.role === 'Transporter';

    const refetch = () => queryClient.invalidateQueries({ queryKey: ['pod-detail', id] });

    const handleProcessOcr = async () => {
        setActionLoading('ocr');
        try { await processOcr(id!); refetch(); } catch (e) { console.error(e); }
        setActionLoading(null);
    };

    const handleReconcile = async () => {
        setActionLoading('recon');
        try { await reconcilePod(id!); refetch(); } catch (e) { console.error(e); }
        setActionLoading(null);
    };

    const handleReviewLine = async (lineId: string, action: string) => {
        try { await reviewLineApi(id!, lineId, { action }); refetch(); } catch (e) { console.error(e); }
    };

    const handleOverrideSubmit = async () => {
        if (!overrideModal) return;
        try {
            await reviewLineApi(id!, overrideModal.id, {
                action: 'OVERRIDDEN',
                receivedQty: overrideQty ? parseInt(overrideQty) : undefined,
                damagedQty: overrideDamaged ? parseInt(overrideDamaged) : undefined,
            });
            setOverrideModal(null);
            refetch();
        } catch (e) { console.error(e); }
    };

    const handleResolveException = async (exId: string) => {
        try { await resolveExceptionApi(id!, exId, actor); refetch(); } catch (e) { console.error(e); }
    };

    const handleApprove = async () => {
        setActionLoading('approve');
        try { await approvePod(id!, actor, approveComment); refetch(); } catch (e) { console.error(e); }
        setActionLoading(null);
    };

    const handleReject = async () => {
        setActionLoading('reject');
        try {
            await rejectPod(id!, actor, rejectComment);
            setShowRejectModal(false);
            refetch();
        } catch (e) { console.error(e); }
        setActionLoading(null);
    };

    if (podQuery.isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader />
            </div>
        );
    }

    if (!pod) {
        return (
            <div className="text-center" style={{ padding: rem14(24) }}>
                <Alert variant="warning">
                    <AlertDescription>POD not found</AlertDescription>
                </Alert>
            </div>
        );
    }

    const unresolvedExceptions = exceptions.filter((e: any) => !e.resolved);

    return (
        <div className="max-w-7xl mx-auto flex flex-col" style={{ padding: rem14(24), gap: rem14(16) }}>
            {/* Header */}
            <div className="flex items-center" style={{ gap: rem14(16) }}>
                <Button
                    variant="ghost"
                    size="sm"
                    icon="arrow-left"
                    onClick={() => navigate(backPath)}
                />
                <div className="flex-1">
                    <div className="flex items-center" style={{ gap: rem14(16) }}>
                        <Typography variant="title-secondary" color="primary">
                            {pod.awbNumber || pod.fileName}
                        </Typography>
                        <PodStatusBadge status={pod.status} />
                    </div>
                    <Typography variant="body-secondary-regular" color="tertiary">
                        Uploaded {new Date(pod.createdAt).toLocaleString()}
                    </Typography>
                </div>
            </div>

            {/* Steps indicator */}
            <Card>
                <CardBody>
                    <Steps current={currentStep}>
                        <StepsList>
                            {STEPS.map((step) => (
                                <StepItem key={step}>
                                    <StepTitle>{step}</StepTitle>
                                </StepItem>
                            ))}
                        </StepsList>
                    </Steps>
                </CardBody>
            </Card>

            {/* Two-column layout */}
            <div className="grid grid-cols-5" style={{ columnGap: rem14(24) }}>
                {/* Left panel */}
                <div className="col-span-3 flex flex-col" style={{ gap: rem14(16) }}>
                    {/* Action buttons for processing */}
                    {pod.status === 'UPLOADED' && !isTransporter && (
                        <Button
                            variant="primary"
                            size="md"
                            icon="clock"
                            loading={actionLoading === 'ocr'}
                            disabled={actionLoading === 'ocr'}
                            onClick={handleProcessOcr}
                        >
                            Run OCR Processing
                        </Button>
                    )}

                    {pod.status === 'PROCESSED' && !isTransporter && (
                        <Button
                            variant="primary"
                            size="md"
                            icon="clock"
                            loading={actionLoading === 'recon'}
                            disabled={actionLoading === 'recon'}
                            onClick={handleReconcile}
                        >
                            Run Reconciliation
                        </Button>
                    )}

                    {/* Tabs */}
                    <Tabs defaultValue="ocr" type="primary">
                        <TabsList>
                            <TabsTrigger value="ocr">OCR Result</TabsTrigger>
                            <TabsTrigger value="recon">Reconciliation</TabsTrigger>
                            <TabsTrigger value="exceptions">
                                Exceptions
                                {unresolvedExceptions.length > 0 && (
                                    <Badge variant="danger" size="xs" style={{ marginLeft: rem14(8) }}>
                                        {unresolvedExceptions.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                        </TabsList>

                        {/* OCR Result tab */}
                        <TabsContent value="ocr">
                            <Card>
                                <CardBody>
                                    {ocrResult ? (
                                        <div className="flex flex-col" style={{ gap: rem14(16) }}>
                                            <Descriptions>
                                                <DescriptionsItem label="AWB Number">
                                                    {ocrResult.awbNumber || '\u2014'}
                                                </DescriptionsItem>
                                                <DescriptionsItem label="Consignee">
                                                    {ocrResult.consigneeName || '\u2014'}
                                                </DescriptionsItem>
                                                <DescriptionsItem label="Delivery Date">
                                                    {ocrResult.deliveryDate || '\u2014'}
                                                </DescriptionsItem>
                                                <DescriptionsItem label="Receiver">
                                                    {ocrResult.receiverName || '\u2014'}
                                                </DescriptionsItem>
                                                <DescriptionsItem label="Stamp Present">
                                                    <Badge
                                                        variant={ocrResult.stampPresent ? 'success' : 'warning'}
                                                        size="sm"
                                                    >
                                                        {ocrResult.stampPresent ? 'Yes' : 'No'}
                                                    </Badge>
                                                </DescriptionsItem>
                                                <DescriptionsItem label="Signature Present">
                                                    <Badge
                                                        variant={ocrResult.signaturePresent ? 'success' : 'warning'}
                                                        size="sm"
                                                    >
                                                        {ocrResult.signaturePresent ? 'Yes' : 'No'}
                                                    </Badge>
                                                </DescriptionsItem>
                                                {ocrResult.remarks && (
                                                    <DescriptionsItem label="Remarks">
                                                        {ocrResult.remarks}
                                                    </DescriptionsItem>
                                                )}
                                            </Descriptions>

                                            <div className="border-t border-border-primary" style={{ paddingTop: rem14(16) }}>
                                                <Button
                                                    variant="text"
                                                    size="sm"
                                                    icon={showRawJson ? 'eye-invisible' : 'preview'}
                                                    onClick={() => setShowRawJson(!showRawJson)}
                                                >
                                                    {showRawJson ? 'Hide' : 'Show'} Raw JSON
                                                </Button>
                                                {showRawJson && (
                                                    <pre className="rounded bg-bg-secondary overflow-auto max-h-96" style={{ marginTop: rem14(8), padding: rem14(16), fontSize: rem14(12) }}>
                                                        {JSON.stringify(JSON.parse(ocrResult.rawOcrJson), null, 2)}
                                                    </pre>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center" style={{ paddingBlock: rem14(24) }}>
                                            <Typography variant="body-secondary-regular" color="tertiary">
                                                OCR has not been run yet
                                            </Typography>
                                        </div>
                                    )}
                                </CardBody>
                            </Card>
                        </TabsContent>

                        {/* Reconciliation tab */}
                        <TabsContent value="recon">
                            <Card>
                                <CardBody>
                                    <ReconLineTable
                                        lines={lineRecons}
                                        onReview={handleReviewLine}
                                        onOverride={(line: any) => {
                                            setOverrideModal(line);
                                            setOverrideQty(String(line.receivedQty));
                                            setOverrideDamaged(String(line.damagedQty));
                                        }}
                                        readOnly={isTransporter || pod.status === 'APPROVED' || pod.status === 'REJECTED'}
                                    />
                                </CardBody>
                            </Card>
                        </TabsContent>

                        {/* Exceptions tab */}
                        <TabsContent value="exceptions">
                            <Card>
                                <CardBody>
                                    {exceptions.length > 0 ? (
                                        <div className="flex flex-col" style={{ gap: rem14(16) }}>
                                            {exceptions.map((exc: any) => (
                                                <Card key={exc.id}>
                                                    <CardBody>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center" style={{ gap: rem14(16) }}>
                                                                <Icon
                                                                    name="warning"
                                                                    style={{
                                                                        color: exc.resolved
                                                                            ? undefined
                                                                            : 'var(--color-critical)',
                                                                    }}
                                                                    className={exc.resolved ? 'text-primary-300' : ''}
                                                                />
                                                                <div>
                                                                    <ExceptionBadge
                                                                        type={exc.exceptionType}
                                                                        severity={exc.severity}
                                                                    />
                                                                    <Typography
                                                                        variant="body-secondary-regular"
                                                                        color="tertiary"
                                                                        style={{ marginTop: rem14(8) }}
                                                                    >
                                                                        {exc.description}
                                                                    </Typography>
                                                                </div>
                                                            </div>
                                                            {!exc.resolved && !isTransporter ? (
                                                                <Button
                                                                    variant="primary"
                                                                    size="sm"
                                                                    onClick={() => handleResolveException(exc.id)}
                                                                >
                                                                    Resolve
                                                                </Button>
                                                            ) : (
                                                                <Badge variant="success" size="sm">
                                                                    {exc.resolved ? 'Resolved' : 'Open'}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </CardBody>
                                                </Card>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center" style={{ paddingBlock: rem14(24) }}>
                                            <Typography variant="body-secondary-regular" color="tertiary">
                                                No exceptions detected
                                            </Typography>
                                        </div>
                                    )}
                                </CardBody>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Right panel */}
                <div className="col-span-2 flex flex-col" style={{ gap: rem14(16) }}>
                    {/* Image viewer */}
                    <PodImageViewer filePath={pod.filePath} fileName={pod.fileName} />

                    {/* Exception summary */}
                    {unresolvedExceptions.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    <Typography variant="body-primary-medium" color="primary">
                                        Exception Summary
                                    </Typography>
                                </CardTitle>
                            </CardHeader>
                            <CardBody>
                                <div className="flex flex-wrap" style={{ gap: rem14(8) }}>
                                    {unresolvedExceptions.map((exc: any) => (
                                        <ExceptionBadge
                                            key={exc.id}
                                            type={exc.exceptionType}
                                            severity={exc.severity}
                                        />
                                    ))}
                                </div>
                            </CardBody>
                        </Card>
                    )}

                    {/* Approval history */}
                    {approvals.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    <Typography variant="body-primary-medium" color="primary">
                                        Approval History
                                    </Typography>
                                </CardTitle>
                            </CardHeader>
                            <CardBody>
                                <div className="flex flex-col">
                                    {approvals.map((a: any) => (
                                        <div
                                            key={a.id}
                                            className="flex items-center justify-between border-b border-border-primary last:border-0"
                                            style={{ paddingBlock: rem14(8) }}
                                        >
                                            <Typography variant="body-secondary-regular" color="tertiary">
                                                Level {a.level}
                                            </Typography>
                                            <Badge
                                                variant={
                                                    a.action === 'APPROVED'
                                                        ? 'success'
                                                        : a.action === 'REJECTED'
                                                            ? 'danger'
                                                            : 'warning'
                                                }
                                                size="sm"
                                            >
                                                {a.action}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </CardBody>
                        </Card>
                    )}

                    {/* Review action buttons */}
                    {pod.status === 'REVIEW' && !isTransporter && (
                        <Card>
                            <CardBody>
                                <div className="flex flex-col" style={{ gap: rem14(16) }}>
                                    <Input>
                                        <InputLabel>Comment</InputLabel>
                                        <InputField
                                            placeholder="Comment (optional)"
                                            value={approveComment}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                                setApproveComment(e.target.value)
                                            }
                                        />
                                    </Input>
                                    <div className="flex" style={{ gap: rem14(16) }}>
                                        <Button
                                            variant="primary"
                                            size="md"
                                            icon="check"
                                            loading={actionLoading === 'approve'}
                                            disabled={actionLoading === 'approve'}
                                            onClick={handleApprove}
                                            className="flex-1"
                                        >
                                            {approveLabel}
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            size="md"
                                            icon="close"
                                            onClick={() => setShowRejectModal(true)}
                                            className="flex-1"
                                        >
                                            Reject POD
                                        </Button>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    )}
                </div>
            </div>

            {/* Override Modal */}
            <Modal open={!!overrideModal} onOpenChange={(open: boolean) => !open && setOverrideModal(null)}>
                <ModalContent>
                    <ModalHeader>
                        <ModalTitle>Override Quantities</ModalTitle>
                    </ModalHeader>
                    <ModalBody>
                        <Typography variant="body-secondary-regular" color="tertiary" style={{ marginBottom: rem14(16) }}>
                            {overrideModal?.description}
                        </Typography>
                        <div className="flex flex-col" style={{ gap: rem14(16) }}>
                            <Input>
                                <InputLabel>Received Qty</InputLabel>
                                <InputField
                                    placeholder="Enter received quantity"
                                    value={overrideQty}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                        setOverrideQty(e.target.value)
                                    }
                                />
                            </Input>
                            <Input>
                                <InputLabel>Damaged Qty</InputLabel>
                                <InputField
                                    placeholder="Enter damaged quantity"
                                    value={overrideDamaged}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                        setOverrideDamaged(e.target.value)
                                    }
                                />
                            </Input>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            variant="secondary"
                            size="md"
                            onClick={() => setOverrideModal(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            size="md"
                            onClick={handleOverrideSubmit}
                        >
                            Save Override
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Reject Modal */}
            <Modal open={showRejectModal} onOpenChange={(open: boolean) => !open && setShowRejectModal(false)}>
                <ModalContent>
                    <ModalHeader>
                        <ModalTitle>Reject POD</ModalTitle>
                    </ModalHeader>
                    <ModalBody>
                        <Textarea>
                            <TextareaLabel>Reason for rejection</TextareaLabel>
                            <TextareaField
                                placeholder="Reason for rejection (required)"
                                value={rejectComment}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                                    setRejectComment(e.target.value)
                                }
                            />
                        </Textarea>
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            variant="secondary"
                            size="md"
                            onClick={() => setShowRejectModal(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            size="md"
                            loading={actionLoading === 'reject'}
                            disabled={!rejectComment.trim() || actionLoading === 'reject'}
                            onClick={handleReject}
                        >
                            {actionLoading === 'reject' ? 'Rejecting...' : 'Confirm Reject'}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
}
