import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Button,
    Badge,
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
    Modal,
    ModalContent,
    ModalHeader,
    ModalTitle,
    ModalBody,
    ModalFooter,
    Textarea,
    Typography,
    Icon,
} from 'ft-design-system';
import { getPendingApprovals, approvePod, rejectPod } from '@/lib/podApi';
import { PodStatusBadge } from '@/components/pod/PodStatusBadge';
import { ExceptionBadge } from '@/components/pod/ExceptionBadge';
import { getReviewerQueuePath, getRoleReviewPath } from '@/auth/routeUtils';
import { rem14 } from '@/lib/rem';

export default function PodApprovalPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [rejectModal, setRejectModal] = useState<string | null>(null);
    const [rejectComment, setRejectComment] = useState('');
    const [loading, setLoading] = useState<string | null>(null);

    const approvalsQuery = useQuery({
        queryKey: ['pending-approvals'],
        queryFn: () => getPendingApprovals(),
    });

    const approvals = approvalsQuery.data || [];
    const refetch = () => queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });

    const handleApprove = async (podId: string) => {
        setLoading(podId);
        try {
            await approvePod(podId, user?.role === 'Reviewer' ? 'reviewer' : 'approver');
            refetch();
        } catch (e) {
            console.error(e);
        }
        setLoading(null);
    };

    const handleReject = async () => {
        if (!rejectModal) return;
        setLoading(rejectModal);
        try {
            await rejectPod(rejectModal, user?.role === 'Reviewer' ? 'reviewer' : 'approver', rejectComment);
            setRejectModal(null);
            setRejectComment('');
            refetch();
        } catch (e) {
            console.error(e);
        }
        setLoading(null);
    };

    return (
        <div className="max-w-6xl mx-auto flex flex-col" style={{ padding: rem14(24), gap: rem14(16) }}>
            <div className="flex items-center" style={{ gap: rem14(16) }}>
                <Button
                    variant="ghost"
                    size="sm"
                    icon="arrow-left"
                    onClick={() => navigate(getReviewerQueuePath())}
                />
                <div className="flex flex-col" style={{ gap: rem14(8) }}>
                    <Typography variant="title-secondary" color="primary">
                        Pending Review
                    </Typography>
                    <Typography variant="body-small" color="secondary">
                        {approvals.length} PODs awaiting final reviewer approval
                    </Typography>
                </div>
                <Badge variant="neutral" size="sm" className="ml-auto">
                    {approvals.length}
                </Badge>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>AWB Number</TableHead>
                        <TableHead>File</TableHead>
                        <TableHead className="text-center">Level</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-center">Exceptions</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {approvals.map((approval: any) => {
                        const pod = approval.podUpload;
                        const unresolvedExc = pod?.exceptions?.filter((e: any) => !e.resolved) || [];
                        return (
                            <TableRow key={approval.id}>
                                <TableCell className="font-medium text-primary-700" style={{ fontSize: rem14(14) }}>
                                    {pod?.awbNumber || '\u2014'}
                                </TableCell>
                                <TableCell className="text-primary-500" style={{ fontSize: rem14(14) }}>
                                    {pod?.fileName}
                                </TableCell>
                                <TableCell className="text-center">
                                    <Badge variant="secondary" size="xs">
                                        Level {approval.level}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                    <PodStatusBadge status={pod?.status || 'REVIEW'} />
                                </TableCell>
                                <TableCell className="text-center">
                                    <div className="flex flex-wrap justify-center" style={{ gap: rem14(8) }}>
                                        {unresolvedExc.length > 0
                                            ? unresolvedExc.slice(0, 2).map((exc: any) => (
                                                <ExceptionBadge key={exc.id} type={exc.exceptionType} />
                                            ))
                                            : <span className="text-primary-300" style={{ fontSize: rem14(12) }}>None</span>
                                        }
                                    </div>
                                </TableCell>
                                <TableCell className="text-center">
                                    <div className="flex items-center justify-center" style={{ gap: rem14(8) }}>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => navigate(getRoleReviewPath("Reviewer", pod.id))}
                                        >
                                            Review
                                        </Button>
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            icon="check"
                                            loading={loading === pod.id}
                                            disabled={loading === pod.id}
                                            onClick={() => handleApprove(pod.id)}
                                        >
                                            Approve
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            icon="close"
                                            onClick={() => setRejectModal(pod.id)}
                                        >
                                            Reject
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                    {approvals.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center text-primary-300" style={{ padding: rem14(24), fontSize: rem14(14) }}>
                                {approvalsQuery.isLoading ? 'Loading...' : 'No pending approvals'}
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>

            {/* Reject Modal */}
            <Modal open={!!rejectModal} onOpenChange={(open: boolean) => { if (!open) { setRejectModal(null); setRejectComment(''); } }}>
                <ModalContent>
                    <ModalHeader>
                        <ModalTitle>Reject POD</ModalTitle>
                    </ModalHeader>
                    <ModalBody>
                        <Textarea
                            placeholder="Reason for rejection (required)"
                            value={rejectComment}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRejectComment(e.target.value)}
                        />
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            variant="secondary"
                            size="md"
                            onClick={() => { setRejectModal(null); setRejectComment(''); }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            size="md"
                            disabled={!rejectComment.trim()}
                            loading={!!loading}
                            onClick={handleReject}
                        >
                            Confirm Reject
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
}
