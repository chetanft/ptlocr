import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Card, CardHeader, CardTitle, CardBody, Checkbox, CheckboxInput, CheckboxLabel, Typography, Icon, message } from "ft-design-system";
import { FilterBar } from "@/components/workspace/FilterBar";
import { PromptEditor } from "@/components/workspace/PromptEditor";
import { SandboxUpload } from "@/components/workspace/SandboxUpload";
import { OcrJsonViewer } from "@/components/workspace/OcrJsonViewer";
import { MappingTable, FieldMapping } from "@/components/workspace/MappingTable";
import { UnmappedFieldsPanel } from "@/components/workspace/UnmappedFieldsPanel";
import { SaveConfigModal } from "@/components/workspace/SaveConfigModal";
import { defaultPrompt, sampleOcrOutput, standardFields } from "@/lib/mockData";
import { getStoredOcrConfig, saveStoredOcrConfig } from "@/lib/ocrConfigStore";
import { autoSuggestMappings } from "@/lib/utils";
import { rem14 } from "@/lib/rem";

export default function ConfigWorkspace() {
  const [searchParams] = useSearchParams();

  // Filter state
  const [moduleId, setModuleId] = useState(searchParams.get("module") || "");
  const [consignorId, setConsignorId] = useState(searchParams.get("consignor") || "");
  const [transporterId, setTransporterId] = useState(searchParams.get("transporter") || "");
  const [configLoaded, setConfigLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Workspace state
  const [prompt, setPrompt] = useState("");
  const [isDefaultPrompt, setIsDefaultPrompt] = useState(true);
  const [mappings, setMappings] = useState<Record<string, FieldMapping>>({});
  const [ocrOutput, setOcrOutput] = useState<Record<string, unknown> | null>(null);
  const [isRunningOcr, setIsRunningOcr] = useState(false);
  const [applyToOthers, setApplyToOthers] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);

  // Load config from URL params on mount
  const handleModuleChange = (value: string) => {
    setModuleId(value);
    setConsignorId("");
    setTransporterId("");
    setConfigLoaded(false);
  };

  const handleConsignorChange = (value: string) => {
    setConsignorId(value);
    setTransporterId("");
    setConfigLoaded(false);
  };

  const handleTransporterChange = (value: string) => {
    setTransporterId(value === "all" ? "" : value);
    setConfigLoaded(false);
  };

  const handleLoadConfig = useCallback(async () => {
    setIsLoading(true);

    try {
      const loadedConfig = getStoredOcrConfig(moduleId, consignorId || null, transporterId || null);

      if (!loadedConfig) {
        setPrompt(defaultPrompt);
        setIsDefaultPrompt(true);
        const defaultMappings: Record<string, FieldMapping> = {};
        standardFields.forEach((field) => {
          defaultMappings[field.id] = { jsonPath: "", mandatory: field.mandatory };
        });
        setMappings(defaultMappings);
        message.info("No existing configuration found. Starting with defaults.");
        setConfigLoaded(true);
        return;
      }

      setPrompt(loadedConfig.prompt || "");
      setIsDefaultPrompt(!loadedConfig.prompt);
      setMappings((loadedConfig.fieldMappings as Record<string, FieldMapping>) || {});
      message.success("Loaded existing configuration.");
      setConfigLoaded(true);
    } catch (error) {
      console.error(error);
      message.error("Failed to load configuration.");
    } finally {
      setIsLoading(false);
    }
  }, [moduleId, consignorId, transporterId]);

  useEffect(() => {
    if (searchParams.get("module")) {
      void handleLoadConfig();
    }
  }, [handleLoadConfig, searchParams]);

  const handleRunOcr = async (file: File) => {
    setIsRunningOcr(true);
    setOcrOutput(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (moduleId) formData.append('module', moduleId);
      if (consignorId) formData.append('consignor', consignorId);
      if (transporterId) formData.append('transporter', transporterId);
      if (prompt) formData.append('overridePrompt', prompt);

      const response = await fetch('/api/ocr/test', {
        method: 'POST',
        body: formData, // fetch automatically sets Content-Type for FormData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `OCR failed: ${response.statusText}`);
      }

      const data = await response.json();
      setOcrOutput(data.rawOcrOutput || data); // Handle both formats just in case
      message.success("Document processed successfully. JSON output is ready for mapping.");
    } catch (error) {
      console.error(error);
      message.error(error instanceof Error ? error.message : "Failed to process document");
    } finally {
      setIsRunningOcr(false);
    }
  };

  const handleMappingChange = (fieldId: string, updates: Partial<FieldMapping>) => {
    setMappings((prev) => ({
      ...prev,
      [fieldId]: { ...prev[fieldId], ...updates },
    }));
  };

  const handleQuickAssign = (fieldId: string, jsonPath: string) => {
    handleMappingChange(fieldId, { jsonPath });
  };

  const handleAutoSuggest = () => {
    // Use the actual OCR output if available, otherwise fall back to sample
    const dataToAnalyze = ocrOutput || sampleOcrOutput;

    // Dynamically match field names to JSON paths using fuzzy matching
    const suggestions = autoSuggestMappings(standardFields, dataToAnalyze);

    const suggestedCount = Object.keys(suggestions).length;

    if (suggestedCount === 0) {
      message.error("Could not find matching JSON paths for the fields. Try uploading a document first.");
      return;
    }

    setMappings((prev) => {
      const updated = { ...prev };
      Object.entries(suggestions).forEach(([fieldId, jsonPath]) => {
        // Only suggest for unmapped fields
        if (!updated[fieldId]?.jsonPath) {
          updated[fieldId] = { ...updated[fieldId], jsonPath, mandatory: updated[fieldId]?.mandatory ?? false };
        }
      });
      return updated;
    });

    message.success(`Suggested ${suggestedCount} mappings based on ${ocrOutput ? "your OCR output" : "sample data"}.`);
  };

  const handleSaveConfig = async () => {
    try {
      saveStoredOcrConfig({
        moduleCode: moduleId,
        consignorCode: consignorId || null,
        transporterCode: transporterId || null,
        prompt: isDefaultPrompt ? null : prompt,
        fieldMappings: mappings,
        updatedBy: 'browser-local',
      });
      message.success("Configuration has been saved in this browser.");
    } catch (error) {
      console.error(error);
      message.error("Failed to save configuration.");
    }
  };

  const handleSavePrompt = () => {
    setIsDefaultPrompt(false);
    message.success(
      applyToOthers
        ? "Opening selection for additional targets..."
        : "Prompt has been saved for this configuration."
    );

    if (applyToOthers) {
      setShowCopyModal(true);
    }
  };

  const handleApplyToTargets = (targets: string[]) => {
    message.success(`Configuration applied to ${targets.length} additional target(s).`);
  };

  if (!configLoaded) {
    return (
      <div className="space-y-6 p-6">
        <FilterBar
          moduleId={moduleId}
          consignorId={consignorId}
          transporterId={transporterId}
          onModuleChange={handleModuleChange}
          onConsignorChange={handleConsignorChange}
          onTransporterChange={handleTransporterChange}
          onLoadConfig={handleLoadConfig}
          isLoading={isLoading}
          configLoaded={configLoaded}
        />

        <div
          className="flex items-center justify-center rounded-lg border-2 border-dashed border-border-primary bg-bg-secondary/30"
          style={{ minHeight: rem14(400) }}
        >
          <div className="text-center">
            <Typography variant="display-primary" color="primary">
              Select a Configuration
            </Typography>
            <Typography variant="body-secondary-regular" color="tertiary" style={{ marginTop: rem14(4) }}>
              Choose a module and consignor, then click "Load / Create Config" to begin.
            </Typography>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <FilterBar
        moduleId={moduleId}
        consignorId={consignorId}
        transporterId={transporterId}
        onModuleChange={handleModuleChange}
        onConsignorChange={handleConsignorChange}
        onTransporterChange={handleTransporterChange}
        onLoadConfig={handleLoadConfig}
        isLoading={isLoading}
        configLoaded={configLoaded}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Prompt & Sandbox */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Prompt & Sandbox</CardTitle>
          </CardHeader>
          <CardBody className="space-y-6">
            <PromptEditor
              prompt={prompt}
              onPromptChange={(value) => {
                setPrompt(value);
                setIsDefaultPrompt(false);
              }}
              isDefault={isDefaultPrompt}
            />

            <div className="border-t pt-6">
              <SandboxUpload
                onRunOcr={handleRunOcr}
                isRunning={isRunningOcr}
                hasResult={!!ocrOutput}
              />
            </div>

            <div className="border-t pt-6">
              <OcrJsonViewer data={ocrOutput} />
            </div>

            <div className="border-t pt-6 space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox>
                  <CheckboxInput
                    checked={applyToOthers}
                    onChange={(e) => setApplyToOthers(e.target.checked)}
                  />
                  <CheckboxLabel>Apply this prompt to other combinations</CheckboxLabel>
                </Checkbox>
              </div>
              <Button variant="primary" icon="save" onClick={handleSavePrompt} className="w-full">
                Save Prompt for This Config
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Right Column: Mapping & Mandatory Fields */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Field Mapping & Mandatory Fields</CardTitle>
              {ocrOutput && (
                <Button variant="secondary" icon="sparkle" onClick={handleAutoSuggest}>
                  Auto-suggest Mapping
                </Button>
              )}
            </div>
          </CardHeader>
          <CardBody className="space-y-6">
            <MappingTable
              mappings={mappings}
              onMappingChange={handleMappingChange}
              hasOcrOutput={!!ocrOutput}
            />

            <UnmappedFieldsPanel
              mappings={mappings}
              onQuickAssign={handleQuickAssign}
            />

            <div className="flex gap-3 border-t pt-6">
              <Button variant="primary" icon="save" onClick={handleSaveConfig} className="flex-1">
                Save Config for This Combination
              </Button>
              <Button
                variant="secondary"
                icon="copy"
                onClick={() => setShowCopyModal(true)}
              >
                Copy to Others
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      <SaveConfigModal
        open={showCopyModal}
        onOpenChange={setShowCopyModal}
        moduleId={moduleId}
        consignorId={consignorId}
        onApply={handleApplyToTargets}
      />
    </div>
  );
}
