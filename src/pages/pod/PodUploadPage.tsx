import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { getDefaultRouteForRole } from '@/auth/routeUtils';
import {
    Button,
    Card,
    CardBody,
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
    Alert,
    AlertTitle,
    AlertDescription,
    Badge,
    Typography,
    Icon,
} from 'ft-design-system';
import { uploadPod, uploadPodBulk, processOcr, processBatch } from '@/lib/podApi';
import { rem14 } from '@/lib/rem';

export default function PodUploadPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<string>('single');
    const [files, setFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const droppedFiles = Array.from(e.dataTransfer.files);
        if (activeTab === 'single') {
            setFiles(droppedFiles.slice(0, 1));
        } else {
            setFiles(prev => [...prev, ...droppedFiles].slice(0, 50));
        }
    }, [activeTab]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const selected = Array.from(e.target.files);
        if (activeTab === 'single') {
            setFiles(selected.slice(0, 1));
        } else {
            setFiles(prev => [...prev, ...selected].slice(0, 50));
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleUploadAndProcess = async () => {
        if (files.length === 0) return;
        setError(null);
        setUploading(true);

        try {
            if (activeTab === 'single') {
                const upload = await uploadPod(files[0]);
                setUploading(false);
                setProcessing(true);
                const ocrResult = await processOcr(upload.id);
                setResults([{ upload, ocrResult, status: 'success' }]);
            } else {
                const bulkResult = await uploadPodBulk(files);
                setUploading(false);
                setProcessing(true);
                const batchResult = await processBatch(undefined, bulkResult.batchId);
                setResults(batchResult.results || []);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setUploading(false);
            setProcessing(false);
        }
    };

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        setFiles([]);
        setResults([]);
        setError(null);
    };

    const isWorking = uploading || processing;
    const fallbackPath = getDefaultRouteForRole(user?.role ?? 'Ops');

    return (
        <div className="max-w-4xl mx-auto flex flex-col" style={{ padding: rem14(24), gap: rem14(16) }}>
            {/* Back button + page title */}
            <div className="flex items-center" style={{ gap: rem14(16) }}>
                <Button
                    variant="ghost"
                    size="sm"
                    icon="arrow-left"
                    onClick={() => navigate(fallbackPath)}
                />
                <div>
                    <Typography variant="title-secondary" color="primary">
                        Upload POD
                    </Typography>
                    <Typography variant="body-secondary" color="secondary">
                        Upload proof of delivery documents for processing
                    </Typography>
                </div>
            </div>

            {/* Tabs for Single / Bulk Upload */}
            <Tabs defaultValue="single" value={activeTab} onValueChange={handleTabChange} type="primary">
                <TabsList>
                    <TabsTrigger value="single">Single Upload</TabsTrigger>
                    <TabsTrigger value="bulk">Bulk Upload</TabsTrigger>
                </TabsList>

                <TabsContent value="single">
                    <DropZone
                        label="Drop a POD file here"
                        onDrop={handleDrop}
                        onFileSelect={handleFileSelect}
                        multiple={false}
                    />
                </TabsContent>

                <TabsContent value="bulk">
                    <DropZone
                        label="Drop POD files here (max 50)"
                        onDrop={handleDrop}
                        onFileSelect={handleFileSelect}
                        multiple
                    />
                </TabsContent>
            </Tabs>

            {/* File list */}
            {files.length > 0 && (
                <div className="flex flex-col" style={{ gap: rem14(16) }}>
                    <div className="flex items-center" style={{ gap: rem14(8) }}>
                        <Typography variant="body-primary" color="primary">
                            Selected Files
                        </Typography>
                        <Badge>{files.length}</Badge>
                    </div>
                    {files.map((file, i) => (
                        <Card key={i}>
                            <CardBody>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center" style={{ gap: rem14(16) }}>
                                        <Icon name="data-stack" className="text-primary-500" />
                                        <div>
                                            <Typography variant="body-primary" color="primary">
                                                {file.name}
                                            </Typography>
                                            <Typography variant="body-secondary" color="secondary">
                                                {(file.size / 1024).toFixed(1)} KB
                                            </Typography>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        icon="close"
                                        onClick={() => removeFile(i)}
                                    />
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            )}

            {/* Error display */}
            {error && (
                <Alert variant="danger">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Success results */}
            {results.length > 0 && (
                <Alert variant="success">
                    <AlertTitle>Processing Complete</AlertTitle>
                    <AlertDescription>
                        {results.filter(r => r.status === 'success').length} of{' '}
                        {results.length} PODs processed successfully.
                    </AlertDescription>
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate(fallbackPath)}
                    >
                        Go to Dashboard
                    </Button>
                </Alert>
            )}

            {/* Upload & Process button */}
            {files.length > 0 && results.length === 0 && (
                <Button
                    variant="primary"
                    size="lg"
                    icon="upload"
                    loading={isWorking}
                    disabled={isWorking}
                    onClick={handleUploadAndProcess}
                    className="w-full"
                >
                    {isWorking
                        ? uploading
                            ? 'Uploading...'
                            : 'Processing OCR...'
                        : 'Upload & Process'}
                </Button>
            )}
        </div>
    );
}

/* ---------- Internal DropZone component ---------- */

interface DropZoneProps {
    label: string;
    onDrop: (e: React.DragEvent) => void;
    onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    multiple: boolean;
}

function DropZone({ label, onDrop, onFileSelect, multiple }: DropZoneProps) {
    const inputId = `pod-file-input-${multiple ? 'bulk' : 'single'}`;

    return (
        <Card>
            <CardBody>
                <div
                    onClick={() => document.getElementById(inputId)?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={onDrop}
                    className="flex flex-col items-center border border-dashed border-border-primary rounded-md text-center cursor-pointer bg-bg-secondary"
                    style={{ gap: rem14(16), padding: rem14(24) }}
                >
                    <Icon name="upload" size="xl" className="text-primary-500" />
                    <Typography variant="body-primary" color="primary">
                        {label}
                    </Typography>
                    <Typography variant="body-secondary" color="secondary">
                        or click to browse
                    </Typography>
                    <input
                        id={inputId}
                        type="file"
                        accept="image/*,.pdf"
                        multiple={multiple}
                        onChange={onFileSelect}
                        className="hidden"
                    />
                </div>
            </CardBody>
        </Card>
    );
}
