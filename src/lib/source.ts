import { loader } from "fumadocs-core/source";
import type { PageData, SourceConfig, VirtualFile } from "fumadocs-core/source";
import type { TOCItemType } from "fumadocs-core/toc";
import type { ReactNode } from "react";

interface DocPageData extends PageData {
  body: (props: Record<string, unknown>) => ReactNode;
  toc: TOCItemType[];
  structuredData: unknown;
  full?: boolean;
}

type DocSourceConfig = SourceConfig & { pageData: DocPageData };

type MdxModule = {
  default: DocPageData["body"];
  toc: unknown[];
  structuredData: unknown;
  frontmatter: { title?: string; description?: string; full?: boolean };
};

type MetaModule = {
  default: { title?: string; pages?: string[]; description?: string };
};

const enMdxModules = import.meta.glob<MdxModule>(
  "../../content/docs/en/**/*.{md,mdx}",
  { eager: true, query: "collection=docs" }
);

const enMetaModules = import.meta.glob<MetaModule>(
  "../../content/docs/en/**/meta.json",
  { eager: true, query: "collection=docs" }
);

const ptMdxModules = import.meta.glob<MdxModule>(
  "../../content/docs/pt/**/*.{md,mdx}",
  { eager: true, query: "collection=docs" }
);

const ptMetaModules = import.meta.glob<MetaModule>(
  "../../content/docs/pt/**/meta.json",
  { eager: true, query: "collection=docs" }
);

function buildFiles(
  mdxModules: Record<string, MdxModule>,
  metaModules: Record<string, MetaModule>,
  stripPrefix: string
): VirtualFile<DocSourceConfig>[] {
  const files: VirtualFile<DocSourceConfig>[] = [];

  for (const [filePath, mod] of Object.entries(mdxModules)) {
    const relativePath = filePath.replace(stripPrefix, "");
    files.push({
      type: "page",
      path: relativePath,
      data: {
        title: mod.frontmatter?.title ?? "Untitled",
        description: mod.frontmatter?.description,
        body: mod.default,
        toc: (mod.toc ?? []) as TOCItemType[],
        structuredData: mod.structuredData,
        full: mod.frontmatter?.full,
      },
    });
  }

  for (const [filePath, mod] of Object.entries(metaModules)) {
    const relativePath = filePath.replace(stripPrefix, "");
    files.push({
      type: "meta",
      path: relativePath,
      data: mod.default,
    });
  }

  return files;
}

// English docs — served at /docs/...
export const source = loader<DocSourceConfig>({
  baseUrl: "/docs",
  source: {
    files: buildFiles(enMdxModules, enMetaModules, "../../content/docs/en/"),
  },
});

// Portuguese docs — served at /pt/docs/...
export const ptSource = loader<DocSourceConfig>({
  baseUrl: "/pt/docs",
  source: {
    files: buildFiles(ptMdxModules, ptMetaModules, "../../content/docs/pt/"),
  },
});
