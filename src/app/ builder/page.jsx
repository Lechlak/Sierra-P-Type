"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import LabelBuilder from "../LabelBuilder";

export default function BuilderPage() {
  const router = useRouter();
  const [saveData, setSaveData] = useState(null);
  const [labelFormats, setLabelFormats] = useState(null);
  const [selectedFormatKey, setSelectedFormatKey] = useState("");
  const [initialFormat, setInitialFormat] = useState(null);

  useEffect(() => {
    const fetchLabelFormats = async () => {
      try {
        const response = await fetch("/labelFormats.json");
        if (!response.ok) throw new Error("Failed to load label formats.");
        const data = await response.json();
        setLabelFormats(data);
      } catch (err) {
        console.error("Error loading label formats:", err);
      }
    };

    fetchLabelFormats();
  }, []);

  const handleLoadFormat = () => {
    if (labelFormats && selectedFormatKey && labelFormats[selectedFormatKey]) {
      setInitialFormat(labelFormats[selectedFormatKey]);
    }
  };

  const handleSave = (key, format) => {
    setSaveData({ key, format });
  };

  const handleCancel = () => {
    router.push("/");
  };

  if (saveData) {
    return (
      <div className="p-8 max-w-2xl mx-auto bg-white mt-10 rounded-lg shadow">
        <h2 className="text-2xl font-bold mb-4">Label Format Saved!</h2>
        <p className="mb-4 text-gray-600">
          Copy the JSON below and add it to your <code>labelFormats.json</code> file to use it in the main application.
        </p>
        <div className="mb-4">
          <p className="font-semibold">Format Key: <code>{saveData.key}</code></p>
        </div>
        <textarea
          readOnly
          className="w-full h-96 p-4 border rounded font-mono text-sm bg-gray-50"
          value={JSON.stringify(saveData.format, null, 2)}
        />
        <div className="mt-6 flex space-x-4">
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(saveData.format, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${saveData.key}.json`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Download JSON
          </button>
          <button
            onClick={() => setSaveData(null)}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            Back to Builder
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col">
      <div className="bg-white border-b p-4 flex items-center gap-4">
        <label className="text-sm font-medium">Load existing format:</label>
        <select
          value={selectedFormatKey}
          onChange={(e) => setSelectedFormatKey(e.target.value)}
          className="p-2 border rounded"
        >
          <option value="">-- Select a format to edit --</option>
          {labelFormats && Object.keys(labelFormats).map(key => (
            <option key={key} value={key}>{labelFormats[key].name || key}</option>
          ))}
        </select>
        <button
          onClick={handleLoadFormat}
          disabled={!selectedFormatKey}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
        >
          Load Format
        </button>
      </div>
      <div className="flex-1">
        <LabelBuilder onSave={handleSave} onCancel={handleCancel} initialFormat={initialFormat} isInline={true} />
      </div>
    </div>
  );
}
