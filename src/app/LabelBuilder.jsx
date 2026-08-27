import React, { useState, useRef, useEffect } from "react";

function LabelBuilder({ onSave, onCancel, initialFormat, isInline = false }) {
  const [name, setName] = useState("Custom Label");
  const [width, setWidth] = useState("1in");
  const [height, setHeight] = useState("1.5in");
  const [orientation, setOrientation] = useState("portrait");
  const [fields, setFields] = useState([]);
  const [draggingFieldId, setDraggingFieldId] = useState(null);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const canvasRef = useRef(null);

  // Constants for conversion (display scale)
  const PPI = 200; // Pixels per inch for the builder view
  
  const parseDimension = (dim) => {
    if (dim.endsWith("in")) return parseFloat(dim) * PPI;
    if (dim.endsWith("mm")) return (parseFloat(dim) / 25.4) * PPI;
    return 0;
  };

  const canvasWidth = parseDimension(width);
  const canvasHeight = parseDimension(height);

  const availableFields = [
    { key: "Call No.", label: "Call No." },
    { key: "Author", label: "Author" },
    { key: "Title", label: "Title" },
    { key: "Volume", label: "Volume" },
    { key: "Theme/Sticker", label: "Theme/Sticker" },
    { key: "Series", label: "Series", defaultValue: "Series" },
    { key: "monthYear", label: "Month/Year" },
    { key: "Custom Text", label: "Custom Text", defaultValue: "Text" },
  ];

  useEffect(() => {
    if (initialFormat) {
      setName(initialFormat.name || "Custom Label");
      setWidth(initialFormat.width || "1in");
      setHeight(initialFormat.height || "1.5in");
      setOrientation(initialFormat.orientation || "portrait");
      
      if (initialFormat.fields) {
        const parsedFields = initialFormat.fields.map((f, i) => {
          let x = 0;
          let y = 0;
          let fontSize = "1em";
          let transform = "none";
          let textAlign = "left";
          let fieldWidth = "auto";
          
          if (f.style) {
            const styleParts = f.style.split(';').map(s => s.trim()).filter(Boolean);
            styleParts.forEach(part => {
              const [key, value] = part.split(':').map(s => s.trim());
              if (!key || !value) return;
              
              if (key === 'left') {
                if (value.endsWith('in')) x = parseFloat(value) * PPI;
                else if (value.endsWith('pt')) x = (parseFloat(value) / 72) * PPI;
              }
              if (key === 'top') {
                if (value.endsWith('in')) y = parseFloat(value) * PPI;
                else if (value.endsWith('pt')) y = (parseFloat(value) / 72) * PPI;
              }
              if (key === 'font-size') fontSize = value;
              if (key === 'transform') transform = value;
              if (key === 'text-align') textAlign = value;
              if (key === 'width') fieldWidth = value;
            });
          }
          
          return {
            id: `field-${Date.now()}-${i}`,
            key: f.key,
            x,
            y,
            fontSize,
            transform,
            textAlign,
            width: fieldWidth,
            defaultValue: f.defaultValue || ""
          };
        });
        setFields(parsedFields);
      }
    }
  }, [initialFormat]);

  const handleDragStartNew = (e, field) => {
    e.dataTransfer.setData("field", JSON.stringify(field));
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const fieldData = e.dataTransfer.getData("field");
    if (fieldData) {
      // New field dropped
      const field = JSON.parse(fieldData);
      const newField = {
        id: Date.now(),
        key: field.key,
        x,
        y,
        fontSize: "1em",
        width: "auto",
        textAlign: "left",
        transform: "none", // or rotate(90deg)
        defaultValue: field.defaultValue || "",
      };
      setFields([...fields, newField]);
      setSelectedFieldId(newField.id);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  // Internal dragging (moving existing fields)
  const handleMouseDown = (e, id) => {
    e.stopPropagation();
    setDraggingFieldId(id);
    setSelectedFieldId(id);
    // Note: We could store initial mouse offset here to prevent "snapping" to top-left,
    // but simplified logic centers or uses top-left for now.
    // Ideally calculate: offsetX = e.clientX - elementRect.left
  };

  const handleMouseMove = (e) => {
    if (draggingFieldId) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      setFields(fields.map(f => {
        if (f.id === draggingFieldId) {
          return { ...f, x, y };
        }
        return f;
      }));
    }
  };

  const handleMouseUp = () => {
    setDraggingFieldId(null);
  };

  const updateField = (id, updates) => {
    setFields(fields.map(f => (f.id === id ? { ...f, ...updates } : f)));
  };

  const deleteField = (id) => {
    setFields(fields.filter(f => f.id !== id));
    if (selectedFieldId === id) setSelectedFieldId(null);
  };

  const handleSave = () => {
    // Convert fields to labelFormats.json structure
    const formatFields = fields.map(f => {
      // Convert x, y back to inches
      const leftIn = (f.x / PPI).toFixed(2);
      const topIn = (f.y / PPI).toFixed(2);
      
      let style = `position: absolute; top: ${topIn}in; left: ${leftIn}in; font-size: ${f.fontSize};`;
      if (f.width !== "auto") style += ` width: ${f.width};`;
      if (f.textAlign) style += ` text-align: ${f.textAlign};`;
      if (f.transform && f.transform !== "none") {
        style += ` transform: ${f.transform}; transform-origin: top left;`;
      } else {
        style += ` transform-origin: top left;`;
      }

      const fieldObj = {
        key: f.key === "Custom Text" ? "Custom" : f.key,
        style
      };
      
      // If it's custom text, use defaultValue to store the text
      if (f.key === "Custom Text" || f.defaultValue) {
        fieldObj.defaultValue = f.defaultValue;
      }
      
      // If Custom Text, maybe we need a unique key to prevent collisions if multiple? 
      // generateLabelsHtml iterates fields, so duplicate keys are fine usually.
      
      return fieldObj;
    });

    const newFormat = {
      name,
      width,
      height,
      orientation,
      fields: formatFields
    };
    
    // Generate a unique key
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now();
    
    onSave(key, newFormat);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return alert("Please allow pop-ups to print labels.");

    // Parse dimensions for CSS
    const widthIn = width; 
    const heightIn = height;

    const style = printWindow.document.createElement("style");
    style.textContent = `
      @page {
        size: ${widthIn} ${heightIn};
        margin: 0;
      }
      @media print {
        @page {
            size: ${widthIn} ${heightIn};
            orientation: ${orientation};
        }
        html, body {
          width: ${widthIn};
          height: ${heightIn};
        }
      }
      html, body {
        margin: 0;
        padding: 0;
        width: ${widthIn};
        height: ${heightIn};
        font-family: Arial, sans-serif;
      }
      .label {
        position: relative;
        width: ${widthIn};
        height: ${heightIn};
        overflow: hidden;
      }
      .field {
        position: absolute;
      }
    `;
    printWindow.document.head.appendChild(style);
    
    // Generate Fields HTML
    let fieldsHtml = "";
    fields.forEach(f => {
       const left = (f.x / PPI).toFixed(2) + "in";
       const top = (f.y / PPI).toFixed(2) + "in";
       
       // Construct style string
       let s = `top: ${top}; left: ${left}; font-size: ${f.fontSize};`;
       if (f.width !== "auto") s += ` width: ${f.width};`;
       if (f.textAlign) s += ` text-align: ${f.textAlign};`;
       if (f.transform && f.transform !== "none") {
         s += ` transform: ${f.transform}; transform-origin: top left;`;
       } else {
         s += ` transform-origin: top left;`;
       }
       
       const content = f.key === "Custom Text" ? f.defaultValue : f.key;
       fieldsHtml += `<div class="field" style="${s}">${content}</div>`;
    });

    printWindow.document.body.innerHTML = `<div class="label">${fieldsHtml}</div>`;
    
    printWindow.document.close();
    printWindow.onload = () => setTimeout(() => printWindow.print(), 500);
  };

  const selectedField = fields.find(f => f.id === selectedFieldId);

  return (
    <div className={isInline ? "w-full h-full bg-gray-100 flex flex-col relative z-40" : "fixed inset-0 bg-gray-100 z-50 flex flex-col"} onMouseUp={handleMouseUp} onMouseMove={handleMouseMove}>
      <div className={`bg-white p-4 shadow flex justify-between items-center ${isInline ? 'z-50 relative' : ''}`}>
        <h2 className="text-xl font-bold">Custom Label Builder</h2>
        <div className="space-x-2">
          <button onClick={handlePrint} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Print</button>
          <button onClick={onCancel} className="px-4 py-2 border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save Format</button>
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r p-4 overflow-y-auto">
          <div className="mb-6">
            <label className="block text-sm font-medium mb-1">Format Name</label>
            <input 
              value={name} onChange={e => setName(e.target.value)} 
              className="w-full p-2 border rounded"
            />
          </div>
          
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Dimensions</h3>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label className="text-xs">Width</label>
                <select value={width} onChange={e => setWidth(e.target.value)} className="w-full p-1 border rounded text-sm">
                  <option value="1in">1 in</option>
                  <option value="1.5in">1.5 in</option>
                  <option value="2in">2 in</option>
                  <option value="2.625in">2.625 in</option>
                </select>
              </div>
              <div>
                <label className="text-xs">Height</label>
                 <select value={height} onChange={e => setHeight(e.target.value)} className="w-full p-1 border rounded text-sm">
                  <option value="1in">1 in</option>
                  <option value="1.5in">1.5 in</option>
                  <option value="2in">2 in</option>
                  <option value="0.75in">0.75 in</option>
                </select>
              </div>
            </div>
             <div className="mb-2">
                <label className="text-xs">Orientation</label>
                <select value={orientation} onChange={e => setOrientation(e.target.value)} className="w-full p-1 border rounded text-sm">
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>
          </div>

          <div className="mb-6">
            <h3 className="font-semibold mb-2">Fields</h3>
            <p className="text-xs text-gray-500 mb-2">Drag fields to the label</p>
            <div className="space-y-2">
              {availableFields.map(field => (
                <div 
                  key={field.key}
                  draggable
                  onDragStart={(e) => handleDragStartNew(e, field)}
                  className="p-2 border rounded bg-gray-50 cursor-grab active:cursor-grabbing hover:bg-gray-100"
                >
                  {field.label}
                </div>
              ))}
            </div>
          </div>
          
          {selectedField && (
             <div className="mb-6 border-t pt-4">
               <h3 className="font-semibold mb-2">Selected Field</h3>
               <div className="mb-2">
                 <label className="text-xs block">Font Size</label>
                 <select 
                   value={selectedField.fontSize} 
                   onChange={e => updateField(selectedField.id, { fontSize: e.target.value })}
                   className="w-full p-1 border rounded"
                 >
                   <option value="0.8em">Small (0.8em)</option>
                   <option value="1em">Normal (1em)</option>
                   <option value="1.2em">Large (1.2em)</option>
                   <option value="1.5em">Extra Large (1.5em)</option>
                 </select>
               </div>
               <div className="mb-2">
                 <label className="text-xs block">Rotation</label>
                 <select 
                   value={selectedField.transform} 
                   onChange={e => updateField(selectedField.id, { transform: e.target.value })}
                   className="w-full p-1 border rounded"
                 >
                   <option value="none">None</option>
                   <option value="rotate(90deg)">90 deg</option>
                   <option value="rotate(-90deg)">-90 deg</option>
                   <option value="rotate(180deg)">180 deg</option>
                 </select>
               </div>
               <div className="mb-2">
                 <label className="text-xs block">Text Align</label>
                 <select 
                   value={selectedField.textAlign} 
                   onChange={e => updateField(selectedField.id, { textAlign: e.target.value })}
                   className="w-full p-1 border rounded"
                 >
                   <option value="left">Left</option>
                   <option value="center">Center</option>
                   <option value="right">Right</option>
                 </select>
               </div>
               
               {(selectedField.key === "Custom Text" || selectedField.defaultValue) && selectedField.key !== "Author" && selectedField.key !== "Call No." && (
                  <div className="mb-2">
                   <label className="text-xs block">Text Content</label>
                   <input 
                     value={selectedField.defaultValue}
                     onChange={e => updateField(selectedField.id, { defaultValue: e.target.value })}
                     className="w-full p-1 border rounded"
                   />
                  </div>
               )}
               
               <button 
                 onClick={() => deleteField(selectedField.id)}
                 className="mt-2 w-full p-2 bg-red-100 text-red-600 rounded hover:bg-red-200 text-sm"
               >
                 Remove Field
               </button>
             </div>
          )}
        </div>

        {/* Canvas Area */}
        <div className="flex-1 bg-gray-200 flex items-center justify-center p-8 overflow-auto">
          <div 
            ref={canvasRef}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            style={{ 
              width: canvasWidth, 
              height: canvasHeight,
              backgroundColor: 'white',
              position: 'relative',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              border: '1px solid #ccc'
            }}
          >
            {fields.map(field => (
              <div
                key={field.id}
                onMouseDown={(e) => handleMouseDown(e, field.id)}
                style={{
                  position: 'absolute',
                  top: field.y,
                  left: field.x,
                  fontSize: field.fontSize === '1em' ? '14px' : field.fontSize === '0.8em' ? '11px' : field.fontSize === '1.2em' ? '17px' : '21px', // Approximation for preview
                  cursor: draggingFieldId === field.id ? 'grabbing' : 'grab',
                  border: selectedFieldId === field.id ? '1px dashed blue' : '1px dashed transparent',
                  padding: '2px',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                  transform: field.transform !== 'none' ? field.transform : undefined,
                  transformOrigin: 'top left',
                  textAlign: field.textAlign,
                  // If rotation is used, visual bounding box handling in drag is tricky, simplified here
                }}
              >
                {field.key === "Custom Text" ? field.defaultValue : field.key}
              </div>
            ))}
            
            {fields.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-300 pointer-events-none">
                    Drop fields here
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LabelBuilder;
