import { useCallback, useEffect, useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { uploadPhoto } from "../utils/api.js";

/**
 * Image upload: when apiUrl is set, uploads to Worker (R2); otherwise converts to base64 (localStorage).
 * Supports both existing base64 and http(s) URLs for preview.
 */
export default function ImageUpload({
  label = "Photo",
  initialUrl = "",
  onUploadComplete,
  onRemove,
  inputId,
  apiUrl,
}) {
  const [preview, setPreview] = useState(initialUrl);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setPreview(initialUrl || "");
  }, [initialUrl]);

  const handleFile = useCallback(
    async (file) => {
      if (!file) {
        return;
      }

      const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) {
        setStatus("Invalid file type. Please use JPEG, PNG, or WebP.");
        return;
      }

      const maxSizeMB = 10;
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > maxSizeMB) {
        setStatus(`File too large (${fileSizeMB.toFixed(1)}MB). Maximum size is ${maxSizeMB}MB.`);
        return;
      }

      setStatus("Compressing image...");
      setProgress(10);

      let compressed;
      try {
        compressed = await imageCompression(file, {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          fileType: "image/jpeg",
        });
        setProgress(50);
      } catch (error) {
        setStatus("Compression failed. Please try a different image.");
        return;
      }

      if (apiUrl) {
        setStatus("Uploading...");
        try {
          const url = await uploadPhoto(compressed, (p) => setProgress(50 + Math.round((p * 50) / 100)));
          setPreview(url);
          setStatus("Photo uploaded.");
          setProgress(100);
          if (onUploadComplete) onUploadComplete(url);
        } catch (err) {
          setStatus(err.message || "Upload failed.");
          setProgress(0);
        }
        return;
      }

      const reader = new FileReader();
      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress(50 + Math.round((e.loaded / e.total) * 50));
        }
      };
      reader.onloadend = () => {
        const dataUrl = reader.result;
        if (!dataUrl || typeof dataUrl !== "string") {
          setStatus("Failed to convert image to data URL.");
          return;
        }
        setPreview(dataUrl);
        setStatus("Photo ready.");
        setProgress(100);
        if (onUploadComplete) onUploadComplete(dataUrl);
      };
      reader.onerror = () => setStatus("Failed to process image.");
      reader.onabort = () => setStatus("Image processing cancelled.");
      reader.readAsDataURL(compressed);
    },
    [onUploadComplete, apiUrl]
  );

  const handleInputChange = async (event) => {
    const file = event.target.files?.[0];
    await handleFile(file);
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    await handleFile(file);
  };

  const fileInputRef = useRef(null);

  return (
    <div className="image-upload" style={{ marginBottom: "1rem" }}>
      <div className="form-field">
        {/* Field Header */}
        <div className="field-header" style={{ marginBottom: "0.5rem" }}>
          <label htmlFor={inputId} style={{ fontWeight: 500, display: "block" }}>
            {label}
          </label>
          <span style={{ fontSize: "0.875rem", color: "#64748b" }}>(Optional)</span>
        </div>

        {/* Hidden File Input - no name attribute to avoid form submission conflict */}
        <input
          ref={fileInputRef}
          id={inputId}
          type="file"
          accept="image/*"
          onChange={handleInputChange}
          style={{ display: "none" }}
          aria-label={`Upload ${label}`}
        />

        {/* Drop Zone */}
        <div
          className="drop-zone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          style={{
            border: "2px dashed #cbd5e1",
            borderRadius: "0.375rem",
            padding: "1.5rem",
            textAlign: "center",
            cursor: "pointer",
            backgroundColor: "#f8fafc",
            transition: "background-color 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f1f5f9")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
          aria-label={`Drop zone for ${label}, or press Enter to select file`}
        >
          <div style={{ fontWeight: "500", color: "#334155" }}>Drag & drop an image, or click to select</div>
          <div style={{ fontSize: "0.85rem", marginTop: "0.5rem", color: "#64748b" }}>
            or press Enter to browse files
          </div>
        </div>

        {/* Help Text */}
        <div className="field-footer" style={{ marginTop: "0.5rem" }}>
          <span className="field-hint" style={{ fontSize: "0.875rem", color: "#64748b" }}>
            Accepted formats: JPEG, PNG, WebP. Maximum 10MB (will be compressed to under 500KB).
          </span>
        </div>

        {/* Image Preview */}
        {preview && (
          <div className="image-preview-container" style={{ marginTop: "1rem" }}>
            <img
              src={preview}
              alt={`${label} preview`}
              className="image-preview"
              style={{
                maxWidth: "100%",
                maxHeight: "300px",
                borderRadius: "0.375rem",
                border: "1px solid #e2e8f0",
              }}
            />
          </div>
        )}

        {/* Remove Button */}
        {preview && onRemove ? (
          <button
            type="button"
            onClick={() => {
              setPreview("");
              setProgress(0);
              setStatus("");
              onRemove?.();
            }}
            style={{
              marginTop: "0.75rem",
              padding: "0.5rem 1rem",
              backgroundColor: "transparent",
              border: "1px solid #cbd5e1",
              borderRadius: "0.375rem",
              color: "#64748b",
              cursor: "pointer",
            }}
            aria-label={`Remove ${label}`}
          >
            Remove photo
          </button>
        ) : null}

        {/* Upload Status / Progress */}
        {status ? (
          <div
            className="upload-status"
            role="alert"
            aria-live="polite"
            style={{
              marginTop: "0.75rem",
              padding: "0.75rem",
              borderRadius: "0.375rem",
              backgroundColor:
                status.includes("failed") || status.includes("Invalid")
                  ? "#fee2e2"
                  : status.includes("ready") || status.includes("uploaded")
                    ? "#dcfce7"
                    : "#fef3c7",
              color:
                status.includes("failed") || status.includes("Invalid")
                  ? "#dc2626"
                  : status.includes("ready") || status.includes("uploaded")
                    ? "#16a34a"
                    : "#92400e",
            }}
          >
            <div style={{ marginBottom: progress > 0 && progress < 100 ? "0.5rem" : "0" }}>
              {status}
            </div>
            {progress > 0 && progress < 100 && (
              <>
                <progress
                  value={progress}
                  max="100"
                  style={{ width: "100%", height: "0.5rem" }}
                  aria-label={`Upload progress: ${progress}%`}
                />
                <div style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
                  {progress}%
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
