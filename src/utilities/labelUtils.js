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
  
  if (selectedFormat && selectedFormat.toLowerCase().startsWith("large-print")) {
    return "";
  }
  
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

  if (selectedFormat?.toLowerCase().startsWith("non-fiction")) {
    let prev;
    do {
      prev = cleaned;
      cleaned = cleaned.replace(/(?:\s|<br>|,)+(?:Ed\.?|Edition)\s*\d+(?:(?:[\s\n]|<br>)[\s\S]*)?$/i, "");
      cleaned = cleaned.replace(/(?:\s|<br>|,)+\d{4}(?:-\d{4})?(?:(?:[\s\n]|<br>)[\s\S]*)?$/i, "");
    } while (cleaned !== prev);
  }

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

  const isGraphicSticker = selectedFormat === "graphic-sticker";

  if (hasGraphic && !isGraphicSticker) {
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


  const isLocalAuthor = selectedFormat === "local-author";

  if (/^(?:\d+|j|jf|je)(?:\s*\d+)?/i.test(cleaned) && !isWrapFormat && !isNonfictionVertical && !hasGraphic) {
    cleaned = cleaned.replace(/\s+\p{L}{3}$/u, "").trim();
    cleaned = cleaned.replace(/\s+[A-Za-z].*$/, "").trim();
  }    


  if (cleaned.toLowerCase().startsWith("j")) {
    cleaned = cleaned.replace(/\s+v(ol)?\.?\s*\d.*$/i, "").trim();

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
      let monthYearContent = "";

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
      const isStickerFormat = selectedFormat?.toLowerCase().includes("sticker");
      const normalizedThemeSticker = String(row["Theme/Sticker"] || "").trim().toLowerCase();
      const isScienceFictionTheme =
        normalizedThemeSticker === "science fiction" ||
        normalizedThemeSticker === "science fic";
      const isNonfictionVerticalFormat = selectedFormat?.startsWith("non-fiction-vertical");
      const isNonfictionWrapFormat = selectedFormat?.toLowerCase().startsWith("non-fiction-wrap");
      const isFictionWrapFormat = selectedFormat?.toLowerCase().startsWith("fiction-wrap");
      const isLargePrintWrapFormat = selectedFormat?.toLowerCase().startsWith("large-print-wrap");
      const effectiveCallNo = (row["Call No."] || "").trim() || fallbackCallNumber || "";
      const isDeweyCallNumber = /(?:^|\s|<br>)\d{3}(?:\.\d+)?/.test(effectiveCallNo) || /^\d/.test(effectiveCallNo);
      
      const shouldHandleWrapAuthorFromCall =
        isNonfictionWrapFormat || isFictionWrapFormat || isLargePrintWrapFormat;
      const isVerticalFormat = selectedFormat?.toLowerCase().includes("vertical");
      const seriesChosen = Boolean(row["Use Series"]) || row["Theme/Sticker"] === "Series";
      const hasScienceFictionInCallNo = (row["Call No."] || "").toLowerCase().includes("science fiction");

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

        const isLargePrintWrapFormat = selectedFormat?.toLowerCase().startsWith("large-print-wrap");
        const isDeweyCallNum = /(?:^|\s|<br>)\d{3}(?:\.\d+)?/.test(callWithAuthor) || /^\d/.test(callWithAuthor);

        if (isDeweyCallNum && !isBiographyCallNumber(callWithAuthor)) {
          wrapCallNumberOverride = callWithAuthor;
          wrapAuthorFromCall = "";
        } else if ((isNonfictionWrapFormat || isLargePrintWrapFormat) && isBiographyCallNumber(callWithAuthor)) {
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
          
          if (isNonfictionWrapFormat || isLargePrintWrapFormat) {
            if (namePart) callLines.push(namePart);
            if (datePart) callLines.push(datePart);
          }

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

      
      let designationCount = 0;
      const designationKeys = [
        "Theme/Sticker", "Graphic", "Graphic-Teen", "Graphic-Teen-Vertical",
        "Large Print", "Decodable", "Reader", "Series", "CCCollection", "Teen", "Local Author"
      ];
      format.fields.forEach((f) => {
        if (designationKeys.includes(f.key)) {
          let val = f.useTheme ? row["Theme/Sticker"] : (row[f.key] || f.defaultValue || "");
          if (f.key === "Theme/Sticker" && format.name === "General" && (!row["Theme/Sticker"] || String(row["Theme/Sticker"]).trim() === "")) {
             val = "";
          }
          if (val && String(val).trim() !== "") {
            designationCount++;
          }
        }
      });

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
            
          if (/^\d/.test(rawCall) && !isNonfictionVertical && selectedFormat !== "graphic-sticker") {
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

        // If Call No is empty for large print wrap, shift Author up by 0.2in
        if (field.key === "Author" && selectedFormat === "large-print-wrap" && !effectiveCallNumber) {
          currentStyle = currentStyle.replace(/top:\s*([0-9.]+)in/, (match, p1) => `top: ${(parseFloat(p1) - 0.2).toFixed(2)}in`);
        }

        // Override author display for nonfiction wrap formats so we keep the
        // full cleaned author instead of a 3-letter code. Apply to Dewey and
        // 92 biography call numbers.
        if (
          field.key === "Author" &&
          (isNonfictionWrap || (selectedFormat === "large-print-wrap" && isDeweyCallNumber))
        ) {
          const callNumberForAuthor = row["Call No."] || "";
          const isDeweyCallNumLocal = /(?:^|\s|<br>)\d{3}(?:\.\d+)?/.test(callNumberForAuthor) || /^\d/.test(callNumberForAuthor);
          const biographyCallNumber = isBiographyCallNumber(callNumberForAuthor);

          if (isDeweyCallNumLocal || biographyCallNumber) {
            value = "";
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
              let newTop = originalTop + offset * 0.15;
              
              if (selectedFormat === "large-print-wrap" && is92CallNumber) {
                 newTop -= 0.15;
              }

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
          } else if (/^(j|je|jf|R|f)\s+\d/i.test(value)) {
            const parts = value.split(/\s+/).filter(Boolean);
            if (parts.length > 2) {
              const prefixWithNumber = `${parts[0]} ${parts[1]}`;
              value = `${prefixWithNumber}<br>${parts.slice(2).join("<br>")}`;
            }
          } else if (value.includes(" ")) {
            value = value.replace(/ /g, "<br>");
          }

          if (isNonfictionWrapFormat && seriesChosen && hasScienceFictionInCallNo) {
            value = value
              .replace(/<br\s*\/?>(\s*)/gi, " ")
              .replace(/\s+/g, " ")
              .trim()
              .split(" ")
              .filter(Boolean)
              .join("<br>");

            if (!currentStyle.includes("line-height:")) {
              currentStyle = `${currentStyle} line-height: 0.9em;`;
            }
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

        if (field.key === "Theme/Sticker" && selectedFormat === "cc-collection" && value.length > 18) {
          // Replace only the first space to keep things like "School Age" together
          value = value.replace(" ", "<br>");
          currentStyle = currentStyle.replace(/left:\s*([0-9.]+)in/, (match, p1) => `left: ${(parseFloat(p1) + 0.16).toFixed(2)}in`);
          if (!currentStyle.includes("line-height:")) {
             currentStyle = `${currentStyle} line-height: 1.1;`;
          }
        }

        if (field.key === "Theme/Sticker" && isScienceFictionTheme) {
          const normalizedSticker = String(value).trim().toLowerCase();
          if (normalizedSticker === "science fiction" || normalizedSticker === "science fic") {
            if (selectedFormat === "j-wrap-chapter-vertical-template") {
              value = "Science Fiction";
            } else {
              value = "Science<br>Fiction";
            }
          }
        }

        if (shouldHandleWrapAuthorFromCall && field.key === "Author") {
          const callNumberForAuthor = row["Call No."] || "";
          const isDeweyCallNumLocal = /(?:^|\s|<br>)\d{3}(?:\.\d+)?/.test(callNumberForAuthor) || /^\d/.test(callNumberForAuthor);
          if ((isNonfictionWrapFormat || selectedFormat === "large-print-wrap") && (is92CallNumber || isDeweyCallNumLocal)) {
            value = "";
          } else if (wrapAuthorFromCall) {
            value = wrapAuthorFromCall;
          } else if (rawFullAuthorSanitized) {
            value = formatAuthor(rawFullAuthorSanitized);
          }
        }

        if (field.key === "Author" && selectedFormat === "local-author" && is92CallNumber) {
          value = "";
        }

        if (row["Theme/Sticker"] && row["Theme/Sticker"].trim() !== "") {
          const formatName = format.name.toLowerCase();

          // Call No Shifts
          if (field.key === "Call No.") {
            if (formatName.includes("wrap") && currentStyle.includes("top: 0.1in")) {
              currentStyle = currentStyle.replace("top: 0.1in", "top: 0.3in");
            } else if (formatName.includes("wrap") && currentStyle.includes("top: 0in") && !formatName.includes("j wrap") && !formatName.includes("juvenile")) {
              currentStyle = currentStyle.replace("top: 0in", "top: 0.2in");
            } else if (
              (formatName.includes("large print wrap") || formatName.includes("general")) &&
              currentStyle.includes("top: 0.2in")
            ) {
              currentStyle = currentStyle.replace("top: 0.2in", "top: 0.4in");
            } 
            else if (selectedFormat === "juvenile-reader") {
              if (row["Theme/Sticker"].length > 11) {
                currentStyle = currentStyle.replace("top: 0.1in", "top: 0.5in");
              } else {
                currentStyle = currentStyle.replace("top: 0.1in", "top: 0.3in");
              }
            }
            else if (selectedFormat === "j-wrap-template" || selectedFormat === "j-wrap-chapter-vertical-template") {
              currentStyle =
                "text-align: right;position: absolute; top: 0in; left: 0.57in; font-size: 1em; text-align: right; transform-origin: top left;";
            } else if (selectedFormat === "juvenile-chapter-wrap") {
              if (currentStyle.includes("top: 0.25in")) {
                currentStyle = currentStyle.replace("top: 0.25in", "top: 0.5in");
              }
            }
          }

          // Author Shifts
          if (field.key === "Author") {
            if (
              formatName.includes("wrap") &&
              !formatName.includes("j wrap") &&
              currentStyle.includes("top: 0.3in")
            ) {
              // Covers fiction, non-fiction, text-wrap
              currentStyle = currentStyle.replace("top: 0.3in", "top: 0.5in");
            } else if (
              formatName.includes("wrap") &&
              !formatName.includes("j wrap") &&
              !formatName.includes("juvenile") &&
              currentStyle.includes("top: 0.2in")
            ) {
              currentStyle = currentStyle.replace("top: 0.2in", "top: 0.4in");
            } else if (
              (formatName.includes("large print wrap") || formatName.includes("general")) &&
              currentStyle.includes("top: 0.4in")
            ) {
              currentStyle = currentStyle.replace("top: 0.4in", "top: 0.6in");
            } else if (selectedFormat === "juvenile-reader") {
              if (row["Theme/Sticker"]?.length > 11) {
                currentStyle = currentStyle.replace("top: 0.3in", "top: 0.7in");
              } else {
                currentStyle = currentStyle.replace("top: 0.3in", "top: 0.5in");
              }
            } else if (selectedFormat === "juvenile-chapter-wrap") {
              if (currentStyle.includes("top: 0.5in")) {
                currentStyle = currentStyle.replace("top: 0.5in", "top: 0.75in");
              }
            }
          }

          // monthYear Shifts
          if (field.key === "monthYear") {
            if (selectedFormat === "juvenile-reader" && currentStyle.includes("top: 0.5in")) {
              currentStyle = currentStyle.replace("top: 0.5in", "top: 0.7in");
            }
          }

          if (field.key === "Graphic" && selectedFormat === "graphic-vertical") {
            currentStyle = currentStyle.replace("left: 0.23in", "left: 0.43in");
          } else if (field.key === "Graphic-Teen-Vertical" && selectedFormat === "teen-graphic-vertical") {
            currentStyle = currentStyle.replace("left: 0.23in", "left: 0.43in");
          }
        }

        // Keep author code below each call-number line when "Science Fiction" wraps by word for series labels.
        if (field.key === "Author" && isNonfictionWrapFormat && seriesChosen && hasScienceFictionInCallNo) {
          const callNoWordCount = (row["Call No."] || "")
            .replace(/<br\s*\/?>(\s*)/gi, " ")
            .replace(/\s+/g, " ")
            .trim()
            .split(" ")
            .filter(Boolean).length;
          const computedTop = Math.min(1.0, 0.26 + callNoWordCount * 0.13);
          currentStyle = currentStyle.replace(/top:\s*[0-9.]+in;/, `top: ${computedTop.toFixed(2)}in;`);
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

        if (field.key === "Call No." && isScienceFictionTheme) {
          const normalizedCallNo = String(value)
            .replace(/<br\s*\/?>/gi, " ")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
          if (normalizedCallNo === "fiction" || normalizedCallNo === "fic") {
            value = "";
          }
        }

        if (
          isWrapFormat &&
          !selectedFormat.toLowerCase().includes("j-wrap") &&
          hasScienceFictionInCallNo
        ) {
          if (field.key === "Call No.") {
            if (!currentStyle.includes("line-height:")) {
              currentStyle = `${currentStyle} line-height: 1em;`;
            }
          } else if (field.key === "Author") {
            const topMatch = currentStyle.match(/top:\s*([0-9.]+)(in|mm|px|em|rem);?/);
            if (topMatch) {
              const originalTop = parseFloat(topMatch[1]);
              const unit = topMatch[2];
              const newTop = originalTop + 0.2;
              currentStyle = currentStyle.replace(
                /top:\s*[0-9.]+(in|mm|px|em|rem);?/,
                `top: ${newTop.toFixed(2)}${unit};`
              );
            }
          }
        }

        if (
          field.key === "Call No." &&
          selectedFormat === "large-print-vertical" &&
          value
        ) {
          if (!/^LP(?:<br>|\s)/i.test(value)) { value = `LP<br>${value}`; }
        }

        
        if (field.key === "Call No." && value) {
          let maxLines = 5 - designationCount;
          if (maxLines < 1) maxLines = 1;

          let extractedDate = "";
          const dateMatch = String(value).match(/(?:<br\s*\/?>|\s|\n)*(\d{4}(?:-\d{0,4})?)$/i);
          let workingValue = String(value);
          if (dateMatch) {
            extractedDate = dateMatch[1];
            workingValue = workingValue.slice(0, -dateMatch[0].length);
          }

          let linesArr = workingValue.split(/<br\s*\/?>|\n/i).map(s => s.trim()).filter(Boolean);
          
          let processedLines = [];
          let currentVirtualLines = 0;
          
          let parsedCharsPerLine = row["Chars/Line"] !== undefined ? parseInt(row["Chars/Line"], 10) : 10;
          if (isNaN(parsedCharsPerLine) || parsedCharsPerLine < 1) parsedCharsPerLine = 10;
          const CHARS_PER_LINE = row["Adjust Label"] ? parsedCharsPerLine : 10; 

          if (isVerticalFormat && row["Adjust Label"]) {
            let unformatted = workingValue.replace(/<br\s*\/?>|\n/gi, " ").replace(/\s+/g, " ").trim();
            while (unformatted.length > 0) {
                processedLines.push(unformatted.substring(0, CHARS_PER_LINE).trimStart());
                unformatted = unformatted.substring(CHARS_PER_LINE);
            }
          } else {
            for (let line of linesArr) {
               let rawWords = line.split(/\s+/);
               let words = [];
               for (let rw of rawWords) {
                  let pieces = [];
                  if (rw.includes('-')) {
                      let parts = rw.split('-');
                      for (let i = 0; i < parts.length; i++) {
                          if (i < parts.length - 1) {
                              pieces.push(parts[i] + '-');
                          } else if (parts[i] !== "") {
                              pieces.push(parts[i]);
                          }
                      }
                  } else {
                      pieces.push(rw);
                  }
                  
                  for (let piece of pieces) {
                      if (piece.length > CHARS_PER_LINE) {
                          let currentPiece = piece;
                          while (currentPiece.length > CHARS_PER_LINE) {
                              words.push(currentPiece.substring(0, CHARS_PER_LINE));
                              currentPiece = currentPiece.substring(CHARS_PER_LINE);
                          }
                          if (currentPiece.length > 0) {
                              words.push(currentPiece);
                          }
                      } else {
                          words.push(piece);
                      }
                  }
               }

               let linesForThisPart = 1;
               let charsInCurrentLine = 0;
               let allowedWords = [];

               for (let word of words) {
                  const spaceNeeded = (charsInCurrentLine === 0 || allowedWords[allowedWords.length - 1].endsWith('-')) ? 0 : 1;

                  if (charsInCurrentLine === 0) {
                     charsInCurrentLine = word.length;
                     allowedWords.push(word);
                  } else if (charsInCurrentLine + spaceNeeded + word.length <= CHARS_PER_LINE) {
                     charsInCurrentLine += spaceNeeded + word.length;
                     allowedWords.push(word);
                  } else {
                     if (currentVirtualLines + linesForThisPart + 1 > maxLines) {
                        break;
                     }
                     if (allowedWords.length > 0) {
                        let joinedLine = "";
                        for (let i = 0; i < allowedWords.length; i++) {
                            if (i > 0 && !allowedWords[i-1].endsWith('-')) {
                                joinedLine += " ";
                            }
                            joinedLine += allowedWords[i];
                        }
                        processedLines.push(joinedLine.replace(/,+$/, ""));
                     }
                     linesForThisPart++;
                     charsInCurrentLine = word.length;
                     allowedWords = [word];
                  }
               }

               if (allowedWords.length > 0) {
                  let joinedLine = "";
                  for (let i = 0; i < allowedWords.length; i++) {
                      if (i > 0 && !allowedWords[i-1].endsWith('-')) {
                          joinedLine += " ";
                      }
                      joinedLine += allowedWords[i];
                  }
                  processedLines.push(joinedLine.replace(/,+$/, ""));
                  currentVirtualLines += linesForThisPart;
               }
               
               if (currentVirtualLines >= maxLines) break;
            }
          }

          if (extractedDate) {
            processedLines.push(extractedDate);
          }

          value = processedLines.join("<br>");
        }

        if (field.key === "Call No." && isVerticalFormat && value) {
          // Preserve the <br> tags inserted by Chars/Line logic, 
          // but replace any remaining spaces within lines with &nbsp;
          value = String(value)
            .split(/<br\s*\/?>/i)
            .map(line => line.trim().replace(/\s+/g, "&nbsp;"))
            .join("<br>");
        }

        const isNonfictionCallNo = /^\d/.test(effectiveCallNumber || "");

        const skipAuthorForWrapFormat =
          field.key === "Author" &&
          (isNonfictionWrapFormat || selectedFormat === "large-print-wrap") &&
          isNonfictionCallNo &&
          !is92CallNumber &&
          !wrapAuthorFromCall;

// Suppress Author field for vertical formats when author is already appended
if (field.key === "Author" && selectedFormat.includes("vertical") && shouldCombineCallAndAuthor) {
    return;   // skip adding author div
}


        if (
          !skipAuthorForWrapFormat &&
          (value ||
            (field.key === "Volume" &&
              !(selectedFormat.startsWith("fiction") && selectedFormat.includes("sticker"))) ||
            (field.key === "Volume" &&
              !(selectedFormat.startsWith("fiction") && selectedFormat.includes("sticker")) &&
              /^\d/.test(effectiveCallNumber || "")))
        ) {
          const fieldClass = `field-${field.key.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
          
          if (field.key === "monthYear") {
            monthYearContent += `<div class="${fieldClass}" style="${currentStyle}">${value}</div>`;
          } else {
            labelContent += `<div class="${fieldClass}" style="${currentStyle}">${value}</div>`;
          }
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

      const formatName = format.name.toLowerCase();
      const isTargetWrapFormat = formatName.includes("wrap") && !formatName.includes("picture") && !formatName.includes("vertical");
      
      let finalContent = "";
      
      if (isTargetWrapFormat) {
        const innerContent = `<div class="label-inner" style="position: absolute; top: 0.1in; left: 0.05in; width: 100%; height: 100%; box-sizing: border-box;">${labelContent}</div>`;
        const innerMonthYearContent = `<div class="label-inner-monthyear" style="position: absolute; top: 0in; left: 0.05in; width: 100%; height: 100%; box-sizing: border-box;">${monthYearContent}</div>`;
        finalContent = `${innerContent}${innerMonthYearContent}`;
      } else {
        const innerContent = `<div class="label-inner" style="position: absolute; top: 0in; left: 0in; width: 100%; height: 100%; box-sizing: border-box;">${labelContent}</div>`;
        const innerMonthYearContent = `<div class="label-inner-monthyear" style="position: absolute; top: 0in; left: 0in; width: 100%; height: 100%; box-sizing: border-box;">${monthYearContent}</div>`;
        finalContent = `${innerContent}${innerMonthYearContent}`;
      }

      if (forPreview) {
        labelsHtml += `<div class="${labelClasses.join(" ")}" style="width: ${format.width}; height: ${format.height}; font-size: 10px; word-wrap: break-word; border: 1px solid #ccc; margin: 5px; display: inline-block; position: relative;">${finalContent}</div>`;
      } else {
        labelsHtml += `<div class="${labelClasses.join(" ")}">${finalContent}</div>`;
      }
    }
  });

  return labelsHtml;
};