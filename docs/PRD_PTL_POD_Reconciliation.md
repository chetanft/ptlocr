# PRD: PTL POD Reconciliation (OCR-Based)

## 1. Objective

Enable automated reconciliation of PODs (Proof of Delivery) for PTL shipments using OCR and intelligent validation to:

- Reduce manual effort in POD verification
- Improve accuracy in freight billing and dispute management
- Detect and flag exceptions (short, damage, stamp mismatch)
- Provide a structured workflow for review and approval

## 2. Problem Statement

Currently, POD reconciliation is manual and error-prone:

- POD images are uploaded but not validated against shipment data
- No structured extraction of received vs sent quantities
- Exceptions like short delivery, damage, or stamp mismatch are not systematically flagged
- Wrong POD uploads (incorrect AWB mapping) go undetected

## 3. Scope (POC)

Build a POC system that:

- Accepts single or bulk POD image uploads
- Uses OCR to extract key fields
- Matches POD to AWB (Air Waybill)
- Performs line-item level reconciliation
- Flags exceptions
- Provides review + override + approval workflow

## 4. Key Functional Capabilities

### 4.1 POD Ingestion

**Upload modes:**
- Single image upload
- Bulk upload (multiple POD images)

**Supported formats:** JPG, PNG, PDF

**Metadata capture:**
- Upload source (Transporter / Ops)
- Timestamp

### 4.2 OCR & Data Extraction

OCR engine extracts:
- AWB Number
- Consignee name
- Delivery date
- Line items (SKU / description if available)
- Sent vs Received quantities (from POD markings)
- Remarks (damage, shortage notes)
- Consignee stamp presence

**Pre-processing:**
- Image enhancement (rotation, contrast, noise reduction)
- Only English language support

### 4.3 AWB Mapping & Validation

Auto-match POD to shipment using:
- Extracted AWB number

**Validation rules:**
- If AWB exists → proceed
- If AWB not found → Flag: "Unmatched POD"
- If duplicate POD for same AWB → Flag: "Duplicate Upload"
- If wrong POD uploaded → Flag: "Mismatch Error"

### 4.4 Line Item Reconciliation Engine

**Fetch planned shipment data:**
- AWB → SKU / item list → dispatched quantities

**Extract POD data:**
- Received quantities per line item

**Perform comparison:**
- Sent vs Received (line-item level)

**Output:**
- Match
- Short
- Excess
- Damaged (based on remarks/markings)

### 4.5 Exception Detection

System auto-tags POD with:

| Exception | Condition |
|-----------|-----------|
| **Short Delivery** | Received < Sent |
| **Damaged Items** | Based on OCR extracted remarks, keywords (damaged, broken, leakage, etc.) |
| **Consignee Stamp Mismatch** | Stamp not detected / unclear / missing |
| **Unmatched POD** | AWB not found |

### 4.6 Review & Override UI (Critical for POC)

**Display structured view:**

| Field | Value |
|-------|-------|
| AWB | Extracted + Matched |
| Consignee | Extracted |
| Delivery Date | Extracted |
| Line Items | Sent vs Received |

**Line-item level actions:**
- Accept
- Reject
- Override values (manual correction)

**Exception summary panel:**
- Highlight issues (Short / Damage / Stamp Missing)

### 4.7 Workflow & Approval

1. **Step 1:** Transporter uploads POD
2. **Step 2:** System auto-processes & flags exceptions
3. **Step 3:** Ops user reviews and: Accepts OR Overrides OR Rejects
4. **Step 4:** Submit to Next Level Approver (Finance / Central Ops)
5. **Step 5:** Final approval → triggers downstream invoicing

## 5. System Workflow (End-to-End)

1. POD uploaded → stored
2. OCR triggered → extract fields
3. AWB matched → validate
4. Line-item reconciliation → compute differences
5. Exception engine → tag issues
6. UI displays structured reconciliation
7. User reviews → accept/override/reject
8. Approval workflow triggered

## 6. Error Handling

| Scenario | System Action |
|----------|---------------|
| AWB not found | Mark as "Unmatched POD" |
| Wrong POD uploaded | Flag mismatch error |
| OCR failure | Mark as "Low Confidence" and route for manual review |
| Duplicate POD | Flag duplicate |
