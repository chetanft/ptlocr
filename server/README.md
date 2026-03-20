# OCR Service Backend

## Setup

1.  **Environment Variables**:
    Ensure `server/.env` exists and contains:
    ```env
    DATABASE_URL="postgresql://user:password@localhost:5432/ocr_db?schema=public"
    OPENAI_API_KEY="sk-..."
    ```

2.  **Install Dependencies**:
    ```bash
    cd server
    npm install
    ```

3.  **Database Migration**:
    Initialize the database setup.
    ```bash
    cd server
    npx prisma migrate dev --name init
    ```

4.  **Start Server**:
    ```bash
    cd server
    npm run dev
    ```
    Server runs on `http://localhost:3001`.

## APIs

- `GET /api/ocr/config`: Get config for module/consignor/transporter.
- `POST /api/ocr/config`: Save config.
- `POST /api/ocr/test`: Run sandbox OCR (Multipart file upload).
- `POST /api/ocr/process-document`: Run production flow.

## Testing with curl

```bash
curl -X POST http://localhost:3001/api/ocr/process-document \
  -F "file=@/path/to/invoice.jpg" \
  -F "module=freight_invoice"
```
