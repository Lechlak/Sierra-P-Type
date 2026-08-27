// label-utils.js
// Exports: formatAuthor, formatCallNumber, generateLabelsHtml

/**
 * Build a short author code from the provided author string.
 * - Strips diacritics and non-letters, returns up to 3 characters.
 * - Handles O' prefixes by keeping the initial O and next two letters.
 */
export const formatAuthor = (author) => {
  if (!author) return "";

  const normalized = author.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const base = normalized.trim();
  if (!base) return "";

  const lastName = (() => {
    const commaParts = base.split(",").map((part) => part.trim()).filter(Boolean);
    if (commaParts.length) return commaParts[0];

    const words = base.split(/\s+/).filter(Boolean);
    if (words.length) return words[words.length - 1];

    return "";
  })();

  const cleanedLastName = lastName.replace(/[^a-zA-Z]/g, "");
  if (cleanedLastName) {
    if (cleanedLastName.startsWith("O") && cleanedLastName.length > 1) {
      const rest = cleanedLastName.substring(1).toLowerCase();
      return ("O" + rest).substring(0, 3);
    }

    return cleanedLastName.substring(0, 3);
  }

  const cleanedFallback = normalized.replace(/[^a-zA-Z]/g, "");
  if (!cleanedFallback) return "";

  if (cleanedFallback.startsWith("O") && cleanedFallback.length > 1) {
    const rest = cleanedFallback.substring(1).toLowerCase();
    return ("O" + rest).substring(0, 3);
  }

  return cleanedFallback.substring(0, 3);
};

/**
 * Remove catalog noise from a full author string: trailing years, roles, punctuation.
 */
const sanitizeAuthor = (fullAuthorRaw) => {
  if (!fullAuthorRaw) return "";

  let sanitized = String(fullAuthorRaw);

  sanitized = sanitized.replace(/\s*,?\s*\b\d{4}(?:-\d{0,4})?\b/g, "");
  sanitized = sanitized.replace(/\b(author|illustrator|editor|translator)\.?\b/gi, "");
  sanitized = sanitized.replace(/[,;]+/g, ",");
  sanitized = sanitized.replace(/^\s*,\s*/g, "");
  sanitized = sanitized.replace(/\s*,\s*$/g, "");
  sanitized = sanitized.replace(/\s{2,}/g, " ");
  sanitized = sanitized.trim();
  sanitized = sanitized.replace(/[.,\s]+$/, "");

  return sanitized;
};

/**
 * Derive a fallback call number when Sierra does not provide one.
 * For nonfiction formats, prefer a biography-style "92 <Author>" value.
 */
const deriveFallbackCallNumber = (callNumberFromRow, sanitizedAuthor, selectedFormat) => {
  const isNonfictionFormat =
    selectedFormat && selectedFormat.toLowerCase().startsWith("non-fiction");

  if (callNumberFromRow) return callNumberFromRow.trim();
  if (!sanitizedAuthor) return "";

  const authorWords = sanitizedAuthor.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  if (!authorWords) return "";

  if (isNonfictionFormat) {
    //return `92 ${authorWords}`.replace(/\s+/g, " ").trim();
  }

  return authorWords;
};

const isBiographyCallNumber = (callNumber = "") => {
  const normalized = callNumber.replace(/<br>/gi, " ").trim().toLowerCase();
  const withoutLanguage = normalized.replace(/^[a-z]{2,3}\s+/, "").trim();
  return /^(?:92|j\s*92|je\s*92|jf\s*92)\b/.test(withoutLanguage);
};

const splitBiographyCallNumber = (callNumber = "") => {
  const normalized = callNumber.replace(/<br>/gi, " ").trim();
  const match = normalized.match(
    /^(?:(?<language>[A-Za-z]{2,3})\s+)?(?<prefix>(?:j\s*|je\s*|jf\s*)?92)\s*(?<rest>.*)$/i
  );

  const languagePrefix = match?.groups?.language?.trim() || "";
  const prefix = match?.groups?.prefix?.replace(/\s+/g, " ").trim() || "";
  const rest = match?.groups?.rest?.trim() || "";

  return { languagePrefix, prefix, rest };
};

/**
 * Format a call number for label rendering.
 * - Removes volume suffixes when appropriate.
 * - Avoids stripping author codes for wrap and nonfiction-vertical formats.
 */
export const formatCallNumber = (callNumber, themeSticker, selectedFormat) => {
  if (!callNumber) return "";

  let cleaned = callNumber.trim();
  // Remove volume numbers like "v.1", "v 2", "v. 3-4", "vol.3"
  cleaned = cleaned.replace(/\s+(v\.?\s*\d+(-\d+)?|vol\.?\s*\d+|volume\s+\d+)$/i, "");


  const hasGraphic = /graphic/i.test(themeSticker || "") ||
    (selectedFormat && selectedFormat.toLowerCase().includes("graphic"));
  const isWrapFormat = selectedFormat?.toLowerCase().includes("wrap");
  const isNonfictionVertical =
    selectedFormat?.startsWith("non") && selectedFormat?.toLowerCase().includes("vertical");

  if (
    hasGraphic ||
    (!selectedFormat?.startsWith("graphic-vertical-teen") &&
      !selectedFormat?.startsWith("graphic-vertical"))
  ) {
    cleaned = cleaned
      .replace(/(?:<br>|\s)+(v\.?\s*\d+(-\d+)?|vol\.?\s*\d+|volume\s+\d+)$/i, "")
      .trim();
  }

  if (hasGraphic) {
    const graphicParts = cleaned.split(/\s+/).filter(Boolean);
    const firstPart = (graphicParts[0] || "").toLowerCase();
    const secondPart = (graphicParts[1] || "").toLowerCase();
    const isFictionGraphic = firstPart === "f" || firstPart === "fic";
    const isJuvenileFictionGraphic =
      firstPart === "jf" || (firstPart === "j" && (secondPart === "f" || secondPart === "fic"));

    if (isFictionGraphic) {
      cleaned = graphicParts[0];
    } else if (isJuvenileFictionGraphic) {
      cleaned = graphicParts.slice(0, 2).join(" ");
    }
  }


  if (/^(?:\d+|j|jf|je)(?:\s*\d+)?/i.test(cleaned) && !isWrapFormat && !isNonfictionVertical) {
    cleaned = cleaned.replace(/\s+\p{L}{3}$/u, "").trim();
    cleaned = cleaned.replace(/\s+[A-Za-z].*$/, "").trim();
  }    


  if (cleaned.toLowerCase().startsWith("j")) {
    cleaned = cleaned.replace(/\s+v.*$/i, "").trim();

     const parts = cleaned.split(/\s+/).filter(Boolean);
    const hasNumberAfterPrefix = parts.length > 1 && /^\d/.test(parts[1]);
    const lastPart = parts[parts.length - 1];
    const penultimatePart = parts[parts.length - 2];

    if (
      hasNumberAfterPrefix &&
      penultimatePart &&
      lastPart &&
      lastPart.toLowerCase() === penultimatePart.toLowerCase()
    ) {
      parts.pop();
      cleaned = parts.join(" ");
    }

  }

  return cleaned;
};

/**
 * Generate the HTML for labels based on CSV data and a selected format definition.
 */
export const generateLabelsHtml = (
  labelFormats,
  selectedFormat,
  csvData,
  monthYear,
  defaultAuthor = "",
  forPreview = false
) => {
  if (!labelFormats) return "";

  const format = labelFormats[selectedFormat];
  if (!format) return "";

  let labelsHtml = "";

  csvData.forEach((row) => {
    const numCopies = parseInt(row.Copies, 10) || 1;

    for (let i = 0; i < numCopies; i++) {
      let labelContent = "";

      const rawFullAuthorSanitized = sanitizeAuthor(row.FullAuthor || defaultAuthor);
      const callNumberFromRow = (row["Call No."] || "").trim();
      const fallbackCallNumber = deriveFallbackCallNumber(
        callNumberFromRow,
        rawFullAuthorSanitized,
        selectedFormat
      );
      const effectiveCallNumber = fallbackCallNumber;

      const is92CallNumber = isBiographyCallNumber(effectiveCallNumber);
      const isWrapFormat = selectedFormat?.toLowerCase().includes("wrap");
      const isNonfictionVerticalFormat = selectedFormat?.startsWith("non-fiction-vertical");
      const isNonfictionWrapFormat = selectedFormat?.toLowerCase().startsWith("non-fiction-wrap");
      const isFictionWrapFormat = selectedFormat?.toLowerCase().startsWith("fiction-wrap");
      const isLargePrintWrapFormat = selectedFormat?.toLowerCase().startsWith("large-print-wrap");
      const shouldHandleWrapAuthorFromCall =
        isNonfictionWrapFormat || isFictionWrapFormat || isLargePrintWrapFormat;
      const isVerticalFormat = selectedFormat?.toLowerCase().includes("vertical");

      //const hasAuthorField = format.fields.some((f) => f.key === "Author");
      const hasAuthorField = format.fields.some((f) => f.key?.toLowerCase().trim() === "author");

      //const shouldCombineCallAndAuthor = selectedFormat.includes("vertical") && !hasAuthorField;
      //const shouldCombineCallAndAuthor = selectedFormat.includes("vertical") && !hasAuthorField;

      const isNonfictionVertical = selectedFormat.toLowerCase().includes("non-fiction-vertical");

      //const shouldCombineCallAndAuthor = selectedFormat.includes("vertical") && !hasAuthorField && !isNonfictionVertical;

      const isGraphicFormat = selectedFormat.toLowerCase().includes("graphic");

      const shouldCombineCallAndAuthor =
        selectedFormat.includes("vertical") &&
        !hasAuthorField &&
        !isNonfictionVertical &&
        !isGraphicFormat;

  
      const callNoLines = (() => {
        if (!is92CallNumber) return 0;
        const { languagePrefix, rest } = splitBiographyCallNumber(effectiveCallNumber);
        const restParts = rest ? rest.split(",").filter(Boolean).length : 0;
        return (languagePrefix ? 1 : 0) + 1 + restParts;
      })();

      let wrapAuthorFromCall = null;
      let wrapCallNumberOverride = null;

      if (shouldHandleWrapAuthorFromCall) {
        const callWithAuthor =
          (row["Call No."] && row["Call No."].trim()) || fallbackCallNumber || "";

        if (isNonfictionWrapFormat && isBiographyCallNumber(callWithAuthor)) {
          const { languagePrefix, prefix, rest } = splitBiographyCallNumber(callWithAuthor);
          const { namePart, datePart } = (() => {
            const match = rest.match(/^(.*?)(?:[,\s]+)?(\d{4}(?:-\d{0,4})?)$/);

            if (match) {
              return {
                namePart: match[1].replace(/[,\s]+$/, "").trim(),
                datePart: match[2],
              };
            }

            return { namePart: rest.trim(), datePart: "" };
          })();

          const callLines = [];
          if (languagePrefix) callLines.push(languagePrefix);
          callLines.push(prefix || "92");
          if (namePart) callLines.push(namePart);
          if (datePart) callLines.push(datePart);

          wrapCallNumberOverride = callLines.join("<br>");
          wrapAuthorFromCall = ""; // Do not add an author code for 92 call numbers
        } else {
          const normalizedCall = callWithAuthor.replace(/<br>/gi, " ").trim();
          const trailingMatch = normalizedCall.match(/^(.*?)(?:\s+)([A-Za-z]{2,5})$/);
          const formattedAuthor = formatAuthor(rawFullAuthorSanitized);
          const endsWithFormattedAuthor =
            formattedAuthor && new RegExp(`\b${formattedAuthor}$`, "i").test(normalizedCall);

          if (trailingMatch) {
            const [, baseCall, authorCode] = trailingMatch;
            wrapAuthorFromCall = authorCode;
            wrapCallNumberOverride = baseCall.trim();
          } else if (endsWithFormattedAuthor) {
            wrapAuthorFromCall = formattedAuthor;
            wrapCallNumberOverride = normalizedCall
              .slice(0, -formattedAuthor.length)
              .trim();
          }
        }
      }

      const isNonfictionWrap = selectedFormat?.toLowerCase().startsWith("non-fiction-wrap");

      // Iterate through declared fields for this format
      format.fields.forEach((field) => {
        // Get the base value for this field:
        let value =
          field.key === "monthYear" && row["Use monthYear"]
            ? monthYear
            : field.key === "monthYear"
            ? ""
            : row[field.key] || field.defaultValue || "";

        if (field.key === "Call No." && (!value || String(value).trim() === "")) {
          value = fallbackCallNumber;
        }

        let skipCallFormatting = false;

        if (shouldCombineCallAndAuthor && field.key === "Call No.") {
          let rawCall = callNumberFromRow || fallbackCallNumber || "";
          rawCall = formatCallNumber(rawCall, row["Theme/Sticker"], selectedFormat);
          const rawAuthor = rawFullAuthorSanitized || "";
          const authorInCallNo = isBiographyCallNumber(rawCall) && rawAuthor && rawCall.includes(rawAuthor);
          const isNonfictionVertical =
            selectedFormat?.startsWith("non") && selectedFormat?.toLowerCase().includes("vertical");
          const isGraphicFormat = selectedFormat?.toLowerCase().includes("graphic");
          const formattedAuthorCode = formatAuthor(rawAuthor);
          const callEndsWithAuthorCode =
            formattedAuthorCode &&
            new RegExp(`\b${formattedAuthorCode}$`, "i").test(rawCall.replace(/<br>/gi, " "));
            
          if (/^\d/.test(rawCall) && !isNonfictionVertical) {
            rawCall = rawCall.replace(/\s+\p{L}{3}$/u, "").trim();
          }

          let authorPart = "";
          const shouldAppendAuthor = !isGraphicFormat && !isNonfictionVertical;
          
         if (shouldAppendAuthor) {
            if (isBiographyCallNumber(rawCall)) {
              if (!authorInCallNo && rawAuthor) {
                authorPart = rawAuthor.includes(",")
                  ? rawAuthor.split(",")[0].trim()
                  : rawAuthor.substring(0, 15).trim();
              }
            } else if (rawAuthor && !callEndsWithAuthorCode) {
              authorPart = formattedAuthorCode;
            }
            
          } else if (rawAuthor && !callEndsWithAuthorCode) {
            const short = rawAuthor
            authorPart = formattedAuthorCode;  
          }
          else if (rawAuthor) {
            const short = rawAuthor
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^a-zA-Z]/g, "");
            authorPart = short.substring(0, 3);
          }

          value = authorPart ? `${rawCall}\n${authorPart}` : rawCall;

          if (isNonfictionVerticalFormat && isBiographyCallNumber(rawCall)) {
            value = rawCall.replace(/<br>/gi, " ").replace(/,/g, " ").replace(/\s+/g, " ").trim();
          }

          skipCallFormatting = true;
        }

        if (shouldHandleWrapAuthorFromCall && field.key === "Call No.") {
          if (wrapCallNumberOverride !== null) {
            value = wrapCallNumberOverride;
          }
        }

        let currentStyle = field.style;

        // Override author display for nonfiction wrap formats so we keep the
        // full cleaned author instead of a 3-letter code. Apply to Dewey and
        // 92 biography call numbers.
        if (field.key === "Author" && isNonfictionWrap) {
          const callNumberForAuthor = row["Call No."] || "";
          const isDeweyCallNumber = /^\d/.test(callNumberForAuthor);
          const biographyCallNumber = isBiographyCallNumber(callNumberForAuthor);

          if (isDeweyCallNumber || biographyCallNumber) {
            value = rawFullAuthorSanitized;
          }
        }

        // Special formatting when call number is a 92 biography:
        if (
          is92CallNumber &&
          isWrapFormat &&
          !selectedFormat.startsWith("graphic-vertical-teen") &&
          !selectedFormat.startsWith("graphic-vertical")
        ) {
          if (field.key === "Call No.") {
            const { languagePrefix, prefix, rest } = splitBiographyCallNumber(value);
            const { namePart, datePart } = (() => {
              const match = rest.match(/^(.*?)(?:[,\s]+)?(\d{4}(?:-\d{0,4})?)$/);

              if (match) {
                return {
                  namePart: match[1].replace(/[,\s]+$/, "").trim(),
                  datePart: match[2],
                };
              }

              return { namePart: rest.trim(), datePart: "" };
            })();

            const lines = [];
            if (languagePrefix) lines.push(languagePrefix);
            lines.push(prefix || "92");
            if (namePart) lines.push(namePart);
            if (datePart) lines.push(datePart);

            value = lines.join("<br>");
          } else if (field.key === "Author") {
            const topMatch = currentStyle.match(/top:\s*([0-9.]+)(in|mm|px|em|rem);/);
            if (topMatch) {
              const originalTop = parseFloat(topMatch[1]);
              const unit = topMatch[2];
              const offset = callNoLines > 1 ? callNoLines - 2 : 0;
              const newTop = originalTop + offset * 0.15;
              currentStyle = currentStyle.replace(
                /top:\s*[0-9.]+(in|mm|px|em|rem);/,
                `top: ${newTop.toFixed(2)}${unit};`
              );
            }
          }
        } else if (
          field.key === "Call No." &&
          isWrapFormat &&
          !isVerticalFormat &&
          !value.includes("<br>")
        ) {
          if (/^\d/.test(value)) {
            const parts = value.split(/\s+/).filter(Boolean);
            if (parts.length > 1) {
              value = `${parts[0]}<br>${parts.slice(1).join("<br>")}`;
            }
          } else if (/^(j|je|jf)\s+\d/i.test(value)) {
            const parts = value.split(/\s+/).filter(Boolean);
            if (parts.length > 2) {
              const prefixWithNumber = `${parts[0]} ${parts[1]}`;
              value = `${prefixWithNumber}<br>${parts.slice(2).join("<br>")}`;
            }
          } else if (value.includes(" ")) {
            value = value.replace(" ", "<br>");
          }
        }

        if (
          (selectedFormat.startsWith("graphic-vertical-teen") ||
            selectedFormat.startsWith("graphic-teen") ||
            (selectedFormat.startsWith("non") && selectedFormat.includes("vertical"))) &&
          !isNonfictionVerticalFormat &&
          field.key === "Call No." &&
          value &&
          value.length > 15
        ) {
          value = value.substring(0, 15);
        }

        if (field.useTheme) {
          value = row["Theme/Sticker"] || field.defaultValue || "";
        }

        if (shouldHandleWrapAuthorFromCall && field.key === "Author") {
          if (is92CallNumber) {
            value = "";
          } else if (wrapAuthorFromCall) {
            value = wrapAuthorFromCall;
          } else if (rawFullAuthorSanitized) {
            value = formatAuthor(rawFullAuthorSanitized);
          }
        }

        if (
          (format.name === "General" ||
            format.name.includes("Large Print") ||
            format.name.includes("rap")) &&
          field.key === "Call No." &&
          row["Theme/Sticker"] &&
          row["Theme/Sticker"].trim() !== ""
        ) {
          currentStyle = currentStyle.replace("top: 0.3in", "top: 0.4in");
        }

        if (
          format.name === "General" &&
          field.key === "Theme/Sticker" &&
          row["Theme/Sticker"] === "Series"
        ) {
          currentStyle = currentStyle.replace("font-size: 1em;", "font-size: 0.8em;");
        }

        if (
          format.name === "General" &&
          field.key === "Theme/Sticker" &&
          (!row["Theme/Sticker"] || row["Theme/Sticker"].trim() === "")
        ) {
          value = "";
        }

        if (field.prefixKey) {
          const prefix = row[field.prefixKey] || "";
          value = `${prefix}${prefix ? " " : ""}${value}`;
        }

        if (field.key === "Call No." && !skipCallFormatting) {
          value = formatCallNumber(value, row["Theme/Sticker"], selectedFormat);
        }

        if (
          field.key === "Call No." &&
          (selectedFormat === "large-print-vertical" ||
            selectedFormat === "large-print-vertical-sticker") &&
          value &&
          /^\d/.test(value)
        ) {
          value = `LP ${value}`;
        }

        if (field.key === "Call No." && isVerticalFormat && value) {
          const normalizedCall = value
            .replace(/<br\s*\/?>(\s*)/gi, " ")
            .replace(/\s+/g, " ")
            .trim();

          value = normalizedCall.replace(/ /g, "&nbsp;");
        }

        const isNonfictionCallNo = /^\d/.test(effectiveCallNumber || "");
        const skipAuthorForLargePrintWrap =
          field.key === "Author" &&
          (selectedFormat === "large-print-wrap" || selectedFormat === "large-print-wrap-sticker") &&
          isNonfictionCallNo;

// Suppress Author field for vertical formats when author is already appended
if (field.key === "Author" && selectedFormat.includes("vertical") && shouldCombineCallAndAuthor) {
    return;   // skip adding author div
}


        if (
          !skipAuthorForLargePrintWrap &&
          (value ||
            (field.key === "Volume" &&
              !(selectedFormat.startsWith("fiction") && selectedFormat.includes("sticker"))) ||
            (field.key === "Volume" &&
              !(selectedFormat.startsWith("fiction") && selectedFormat.includes("sticker")) &&
              /^\d/.test(effectiveCallNumber || "")))
        ) {
          const fieldClass = `field-${field.key.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
          labelContent += `<div class="${fieldClass}" style="${currentStyle}">${value}</div>`;
        }
      });

      const labelClasses = ["label"];
      const isLongCallNo =
        !is92CallNumber &&
        !selectedFormat.startsWith("non") &&
        effectiveCallNumber &&
        effectiveCallNumber.length > 9;
      if (isLongCallNo) {
        labelClasses.push("long-call-no");
      }

      if (forPreview) {
        labelsHtml += `<div class="${labelClasses.join(" ")}" style="width: ${format.width}; height: ${format.height}; font-size: 10px; word-wrap: break-word; border: 1px solid #ccc; margin: 5px; display: inline-block; position: relative;">${labelContent}</div>`;
      } else {
        labelsHtml += `<div class="${labelClasses.join(" ")}">${labelContent}</div>`;
      }
    }
  });

  return labelsHtml;
};
