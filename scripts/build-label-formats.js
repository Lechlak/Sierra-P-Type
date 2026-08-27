const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");
const templatesDir = path.join(rootDir, "src", "label-formats", "templates");
const publicLabelFormatsPath = path.join(rootDir, "public", "labelFormats.json");
const indexFilePath = path.join(rootDir, "src", "label-formats", "index.js");

const ensureTemplatesFromPublic = () => {
  if (!fs.existsSync(templatesDir)) {
    fs.mkdirSync(templatesDir, { recursive: true });
  }

  const templateFiles = fs
    .readdirSync(templatesDir)
    .filter((file) => file.endsWith(".json"));

  if (templateFiles.length > 0) {
    return;
  }

  if (!fs.existsSync(publicLabelFormatsPath)) {
    throw new Error("No templates found and public/labelFormats.json is missing");
  }

  const publicFormats = JSON.parse(fs.readFileSync(publicLabelFormatsPath, "utf8"));

  Object.entries(publicFormats).forEach(([key, template]) => {
    const targetPath = path.join(templatesDir, `${key}.json`);
    fs.writeFileSync(targetPath, JSON.stringify(template, null, 2));
  });
};

const loadTemplates = () => {
  ensureTemplatesFromPublic();

  const templateFiles = fs
    .readdirSync(templatesDir)
    .filter((file) => file.endsWith(".json"))
    .sort();

  const templates = {};

  templateFiles.forEach((file) => {
    const key = file.replace(/\.json$/, "");
    const content = JSON.parse(fs.readFileSync(path.join(templatesDir, file), "utf8"));
    templates[key] = content;
  });

  return { templates, templateFiles };
};

const writePublicAggregate = (templates) => {
  fs.writeFileSync(publicLabelFormatsPath, JSON.stringify(templates, null, 2));
};

const toImportName = (key) => key.replace(/[^a-zA-Z0-9]/g, "_");

const writeIndexFile = (templateFiles) => {
  const imports = templateFiles.map((file) => {
    const key = file.replace(/\.json$/, "");
    return `import ${toImportName(key)} from "./templates/${file}";`;
  });

  const mappings = templateFiles.map((file) => {
    const key = file.replace(/\.json$/, "");
    return `  "${key}": ${toImportName(key)},`;
  });

  const content = `${imports.join("\n")}

const labelFormats = {
${mappings.join("\n")}
};

export default labelFormats;
`;

  fs.writeFileSync(indexFilePath, content);
};

const main = () => {
  const { templates, templateFiles } = loadTemplates();
  writePublicAggregate(templates);
  writeIndexFile(templateFiles);
  console.log(`Built ${templateFiles.length} label format templates.`);
};

main();
