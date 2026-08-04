/**
 * attachmentStore.js
 *
 * Global attachment queue, usable from anywhere (not just MessageComposer).
 * Pulls the current server + validator_key from App state / connections map
 * at upload time, since validator_key is per-server handshake data, not
 * something that should be passed in as a prop.
 */

import { createStore } from "solid-js/store";
import { state } from "../../App";
import { connections, fetchRoturValidator } from "../../core/server_connection";

export const [attachments, setAttachments] = createStore([]);

export function updateAttachment(id, patch) {
  setAttachments(
    a => a.id === id,
    attachment => ({
      ...attachment,
      ...patch
    })
  );
}

export function removeAttachment(id) {
  setAttachments(prev => prev.filter(a => a.id !== id));
}

export function clearAttachments() {
  setAttachments([]);
}

/**
 * Uploads a single file to the *currently active* server.
 * If you need to target a specific server (not the active one),
 * pass its `src` explicitly as the third arg.
 */
async function uploadAttachment(id, file, serverSrc) {
  const src = serverSrc ?? state.current?.server?.src;

  if (!src) {
    updateAttachment(id, { error: "No active server to upload to" });
    return;
  }

  const connection = connections.get(src);

  if (!connection) {
    updateAttachment(id, { error: "Not connected to server" });
    return;
  }

  const validatorKey = connection.state.serverInfo?.validator_key;

  if (!validatorKey) {
    updateAttachment(id, { error: "Server has no validator_key (handshake not complete?)" });
    return;
  }

  const settings = JSON.parse(localStorage.getItem("settings") || "{}");

  let validator;

  try {
    validator = await fetchRoturValidator(validatorKey, settings.token);
  } catch (err) {
    updateAttachment(id, { error: `Validator fetch failed: ${err.message}` });
    return;
  }

  const xhr = new XMLHttpRequest();
  const form = new FormData();

  form.append("validator_key", validatorKey);
  form.append("validator", validator);
  form.append("file", file);
  form.append("name", file.name);
  form.append("mime_type", file.type);
  form.append("channel", state.current.channel);

  xhr.open("POST", `https://${src}/attachments/upload`);

  xhr.upload.onprogress = e => {
    if (!e.lengthComputable) return;

    updateAttachment(id, {
      progress: Math.round((e.loaded / e.total) * 100)
    });
  };

  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      const response = JSON.parse(xhr.responseText);

      updateAttachment(id, {
        uploaded: true,
        progress: 100,
        serverAttachment: response.attachment
      });
    } else {
      updateAttachment(id, { error: `Upload failed (${xhr.status})` });
    }
  };

  xhr.onerror = () => {
    updateAttachment(id, { error: "Upload failed" });
  };

  xhr.send(form);
}

export function queueAttachment(file, serverSrc) {
  const id = crypto.randomUUID();

  setAttachments(a => [
    ...a,
    {
      id,
      file,
      name: file.name || `pasted-image-${Date.now()}.png`,
      mimeType: file.type,
      preview: file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : null,
      progress: 0,
      uploaded: false,
      error: null
    }
  ]);

  uploadAttachment(id, file, serverSrc);

  return id;
}

export async function fileFromDataURI(dataURI, filename = `image-${Date.now()}.png`) {
  const res = await fetch(dataURI);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type });
}

export async function addAttachment(fileOrDataURI, serverSrc) {
  const file =
    typeof fileOrDataURI === "string"
      ? await fileFromDataURI(fileOrDataURI)
      : fileOrDataURI;

  return queueAttachment(file, serverSrc);
}

export function installGlobalPasteListener() {
  const handler = async (e) => {
    const items = [...(e.clipboardData?.items || [])];

    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) await addAttachment(file);
      }
    }
  };

  document.addEventListener("paste", handler);

  return () => document.removeEventListener("paste", handler);
}