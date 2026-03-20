import { Card, CardHeader, CardBody, Typography } from 'ft-design-system';
import { rem14 } from '@/lib/rem';

interface PodImageViewerProps {
    filePath: string;
    fileName: string;
}

export function PodImageViewer({ filePath, fileName }: PodImageViewerProps) {
    const isPdf = fileName.toLowerCase().endsWith('.pdf');
    const imageUrl = `/${filePath}`;

    return (
        <Card bordered size="sm">
            <CardHeader>
                <Typography variant="body-primary-medium" color="primary">{fileName}</Typography>
            </CardHeader>
            <CardBody>
                <div className="flex items-center justify-center" style={{ minHeight: rem14(400) }}>
                    {isPdf ? (
                        <iframe src={imageUrl} className="w-full" style={{ height: rem14(600) }} title="POD Document" />
                    ) : (
                        <img src={imageUrl} alt="POD Document" className="max-w-full object-contain" style={{ maxHeight: rem14(600) }} />
                    )}
                </div>
            </CardBody>
        </Card>
    );
}
