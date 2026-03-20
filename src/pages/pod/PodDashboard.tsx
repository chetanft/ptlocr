import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { useQuery } from '@tanstack/react-query';
import {
    Button,
    Input,
    InputField,
    Badge,
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
    Typography,
    Icon,
    Pagination,
} from 'ft-design-system';
import { listPods, getPodStats } from '@/lib/podApi';
import { PodStatsCards } from '@/components/pod/PodStatsCards';
import { PodStatusBadge } from '@/components/pod/PodStatusBadge';
import { getRoleReviewPath } from '@/auth/routeUtils';
import { rem14 } from '@/lib/rem';

const STATUS_TABS = ['All', 'UPLOADED', 'PROCESSING', 'PROCESSED', 'REVIEW', 'SUBMITTED', 'APPROVED', 'REJECTED'] as const;

const PAGE_SIZE = 20;

export default function PodDashboard() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const canBulkUpload = user?.role === 'Ops';
    const [statusFilter, setStatusFilter] = useState<string>('All');
    const [awbSearch, setAwbSearch] = useState('');
    const [page, setPage] = useState(1);

    const statsQuery = useQuery({ queryKey: ['pod-stats'], queryFn: getPodStats });
    const podsQuery = useQuery({
        queryKey: ['pods', statusFilter, awbSearch, page],
        queryFn: () => listPods({
            status: statusFilter === 'All' ? undefined : statusFilter,
            awbNumber: awbSearch || undefined,
            page,
            limit: PAGE_SIZE,
        }),
    });

    const stats = statsQuery.data || { total: 0, pending: 0, exceptions: 0, approved: 0 };
    const pods = podsQuery.data || { items: [], total: 0, page: 1, totalPages: 1 };
    const reviewPathFor = (id: string) => getRoleReviewPath(user?.role === 'Reviewer' ? 'Reviewer' : 'Ops', id);

    const handleTabChange = (value: string) => {
        setStatusFilter(value);
        setPage(1);
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setAwbSearch(e.target.value);
        setPage(1);
    };

    const handleRefresh = () => {
        statsQuery.refetch();
        podsQuery.refetch();
    };

    return (
        <div className="max-w-7xl mx-auto flex flex-col" style={{ padding: rem14(24), gap: rem14(24) }}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <Typography variant="title-secondary" color="primary">
                        {user?.role === 'Ops' ? 'Pending Approval' : 'POD Reconciliation'}
                    </Typography>
                    <Typography variant="body-secondary-regular" color="tertiary">
                        {user?.role === 'Ops'
                            ? 'Review transporter-submitted PODs before sending them to final reviewer'
                            : 'Manage proof of delivery documents'}
                    </Typography>
                </div>
                {user?.role !== 'Ops' ? (
                    <Button
                        variant="primary"
                        size="md"
                        icon="arrow-top-right"
                        onClick={() => navigate('/pod/upload')}
                    >
                        Upload POD
                    </Button>
                ) : null}
            </div>

            {/* Stats cards */}
            <PodStatsCards stats={stats} />

            {/* Filter bar */}
            <div className="flex items-center" style={{ gap: rem14(16) }}>
                <div className="flex-1 max-w-sm">
                    <Input>
                        <InputField
                            placeholder="Search by AWB number..."
                            leadingIcon="search"
                            value={awbSearch}
                            onChange={handleSearchChange}
                        />
                    </Input>
                </div>
                <Button
                    variant="ghost"
                    size="md"
                    icon="filter"
                    onClick={handleRefresh}
                    loading={podsQuery.isFetching}
                />
            </div>

            {/* Status tabs and table */}
            <Tabs type="primary" defaultValue="All" value={statusFilter} onValueChange={handleTabChange}>
                <TabsList>
                    {STATUS_TABS.map((tab) => (
                        <TabsTrigger key={tab} value={tab}>
                            {tab}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {STATUS_TABS.map((tab) => (
                    <TabsContent key={tab} value={tab}>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>AWB Number</TableHead>
                                    <TableHead>File Name</TableHead>
                                    <TableHead>Upload Date</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Exceptions</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pods.items.length > 0 ? (
                                    pods.items.map((pod: any) => (
                                        <TableRow
                                            key={pod.id}
                                            onClick={() => navigate(reviewPathFor(pod.id))}
                                            className="cursor-pointer"
                                        >
                                            <TableCell className="text-primary-700 font-medium">
                                                {pod.awbNumber || '\u2014'}
                                            </TableCell>
                                            <TableCell className="text-primary-300">
                                                {pod.fileName}
                                            </TableCell>
                                            <TableCell className="text-primary-300">
                                                {new Date(pod.createdAt).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell>
                                                <PodStatusBadge status={pod.status} />
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={
                                                        (pod.exceptions?.filter((e: any) => !e.resolved).length || 0) > 0
                                                            ? 'danger'
                                                            : 'neutral'
                                                    }
                                                    size="sm"
                                                >
                                                    {pod.exceptions?.filter((e: any) => !e.resolved).length || 0}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    icon="preview"
                                                    onClick={(e: React.MouseEvent) => {
                                                        e.stopPropagation();
                                                        navigate(reviewPathFor(pod.id));
                                                    }}
                                                >
                                                    View
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-primary-300" style={{ padding: rem14(24) }}>
                                            {podsQuery.isLoading
                                                ? 'Loading...'
                                                : 'No PODs found. Upload your first POD to get started.'}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TabsContent>
                ))}
            </Tabs>

            {/* Pagination */}
            {(pods.totalPages > 1 || canBulkUpload) && (
                <div className="flex items-center justify-end" style={{ gap: rem14(12) }}>
                    {canBulkUpload ? (
                        <Button
                            variant="text"
                            size="sm"
                            icon="file-upload"
                            iconPosition="only"
                            aria-label="Upload POD"
                            onClick={() => navigate('/pod/upload')}
                        />
                    ) : null}
                    {pods.totalPages > 1 ? (
                        <Pagination
                            current={page}
                            total={pods.total}
                            pageSize={PAGE_SIZE}
                            onChange={setPage}
                        />
                    ) : null}
                </div>
            )}
        </div>
    );
}
