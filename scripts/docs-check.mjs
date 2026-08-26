import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = join(repoRoot, "docs");
const indexFile = join(docsDir, "README.md");

const SPEC_OWNED = [
  {
    pattern: /\b47\s+itens\b/i,
    belongsTo: "docs/04-Banco-de-Dados.md da spec",
    what: "tamanho do catálogo",
  },
  {
    pattern: /healthScore\s*=/,
    belongsTo: "docs/03-Backend.md da spec",
    what: "fórmula da saúde",
  },
  {
    pattern: /kmPerDay\s*=/,
    belongsTo: "docs/03-Backend.md da spec",
    what: "cálculo do ritmo de uso",
  },
  {
    pattern: /dueDate\s*=/,
    belongsTo: "docs/03-Backend.md da spec",
    what: "cálculo da data de vencimento",
  },
  {
    pattern: /\b06:00\b/,
    belongsTo: "CLAUDE.md da spec (decisão D4)",
    what: "horário do job de alertas",
  },
  {
    pattern: /\bD\d{1,2}\s*·/,
    belongsTo: "CLAUDE.md da spec",
    what: "enunciado de decisão travada",
  },
  {
    pattern: /\|\s*`?(GET|POST|PUT|PATCH|DELETE)`?\s*\|\s*`?\/v1\//,
    belongsTo: "docs/03-Backend.md da spec",
    what: "tabela de contrato da API",
  },
];

const HEADER_MARKERS = ["> **Escopo:**", "> **Fonte da verdade do produto:**"];
const LINK_PATTERN = /\[[^\]]*\]\(([^)]+)\)/g;

const errors = [];
const warnings = [];

const markdownFiles = () =>
  readdirSync(docsDir)
    .filter((name) => name.endsWith(".md"))
    .sort();

const checkHeader = (name, content) => {
  const head = content.split("\n").slice(0, 8).join("\n");
  const missing = HEADER_MARKERS.filter((marker) => !head.includes(marker));
  if (missing.length) {
    errors.push(
      `docs/${name}: cabeçalho incompleto — falta ${missing.join(" e ")} nas primeiras linhas.`,
    );
  }
};

const checkLinks = (name, content) => {
  const fileDir = join(docsDir, "..", "docs");
  for (const match of content.matchAll(LINK_PATTERN)) {
    const target = match[1].trim();
    if (/^(https?:|mailto:|#)/.test(target)) continue;

    const [pathPart] = target.split("#");
    if (!pathPart) continue;

    const resolved = resolve(fileDir, pathPart);
    if (existsSync(resolved)) continue;

    if (resolved.startsWith(repoRoot)) {
      errors.push(`docs/${name}: link quebrado — "${target}" não existe.`);
      continue;
    }

    warnings.push(
      `docs/${name}: link "${target}" sai do repositório e não foi encontrado — esperado quando este repo é clonado sozinho, erro quando a spec está ao lado.`,
    );
  }
};

const checkSpecOwnedFacts = (name, content) => {
  const lines = content.split("\n");
  lines.forEach((line, index) => {
    if (line.trim().startsWith(">")) return;
    for (const rule of SPEC_OWNED) {
      if (rule.pattern.test(line)) {
        errors.push(
          `docs/${name}:${index + 1}: repete ${rule.what}, que pertence a ${rule.belongsTo}. Linke em vez de repetir.`,
        );
      }
    }
  });
};

const checkIndex = (names) => {
  if (!existsSync(indexFile)) {
    errors.push("docs/README.md não existe — o índice é obrigatório.");
    return;
  }
  const index = readFileSync(indexFile, "utf8");
  for (const name of names) {
    if (name === "README.md") continue;
    if (!index.includes(`(./${name})`)) {
      errors.push(`docs/README.md não lista docs/${name} no índice.`);
    }
  }
};

if (!existsSync(docsDir) || !statSync(docsDir).isDirectory()) {
  console.error("docs/ não encontrado.");
  process.exit(1);
}

const names = markdownFiles();

for (const name of names) {
  const content = readFileSync(join(docsDir, name), "utf8");
  checkHeader(name, content);
  checkLinks(name, content);
  checkSpecOwnedFacts(name, content);
}

checkIndex(names);

for (const warning of warnings) console.warn(`aviso  ${warning}`);

if (errors.length) {
  for (const error of errors) console.error(`erro   ${error}`);
  console.error(`\n${errors.length} problema(s) de documentação.`);
  process.exit(1);
}

console.log(`documentação consistente — ${names.length} arquivo(s) verificado(s).`);
