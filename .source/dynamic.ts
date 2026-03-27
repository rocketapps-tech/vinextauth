// @ts-nocheck
/// <reference types="vite/client" />
import { dynamic } from 'fumadocs-mdx/runtime/dynamic';
import * as Config from '../source.config';

const create = await dynamic<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>(Config, {"configPath":"C:\\Projetos\\vinextauth\\source.config.ts","environment":"vite","outDir":"C:\\Projetos\\vinextauth\\.source"}, {"doc":{"passthroughs":["extractedReferences"]}});