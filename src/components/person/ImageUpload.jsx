import { useCallback, useState } from "react";
import imageCompression from "browser-image-compression";
import { getToken } from "../../services/auth.js";

/**
 * Image upload component with compression + progress tracking.
 *
 * Compression settings:
 * - maxSizeMB: 0.5 keeps files under 500KB for faster uploads
 * - maxWidthOrHeight: 1920 preserves detail without huge files
 * - useWebWorker: true avoids blocking the UI thread
 */
export default function ImageUpload({
  label,
  imageType,
  personId,
  initialUrl = "",
  onUploadComplete,
}) {
  const [preview, setPreview] = useState(initialUrl);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");

  const handleFile = useCallback(
    async (file) => {
      if (!file) {
        return;
      }

      // Client-side compression reduces upload time and storage costs.
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: "image/jpeg",
      });

      const dataUrl = await imageCompression.getDataUrlFromFile(compressed);
      setPreview(dataUrl);

      setStatus("Uploading...");
      setProgress(0);

      await uploadFile(compressed, imageType, personId, (percent) => {
        setProgress(percent);
      })
        .then((result) => {
          setStatus("Upload complete.");
          onUploadComplete?.(result.url);
          setPreview(result.url);
        })
        .catch((error) => {
          setStatus(error.message || "Upload failed.");
        });
    },
    [imageType, personId, onUploadComplete]
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

  return (
    <div className="image-upload">
      <label className="form-field">
        {label}
        <input type="file" accept="image/*" onChange={handleInputChange} />
      </label>

      <div
        className="drop-zone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        Drag & drop an image, or click to select.
      </div>

      {preview ? <img src={preview} alt={`${label} preview`} /> : null}

      {status ? (
        <div className="upload-status">
          <span>{status}</span>
          <progress value={progress} max="100" />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Upload file using XMLHttpRequest to track progress events.
 */
function uploadFile(file, imageType, personId, onProgress) {
  const baseUrl = import.meta.env.VITE_API_URL;
  const token = getToken();

  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", imageType);
    if (personId) {
      formData.append("personId", personId);
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${baseUrl}/upload`, true);
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress?.(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const response = JSON.parse(xhr.responseText);
        resolve(response);
      } else {
        reject(new Error("Upload failed. Please try again."));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(formData);
  });
}
