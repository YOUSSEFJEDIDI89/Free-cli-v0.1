declare module "marked-terminal" {
  import type { MarkedExtension } from "marked";
  interface MarkedTerminalOptions {
    code?: (code: string, lang?: string) => string;
    blockquote?: (text: string) => string;
    html?: (text: string) => string;
    heading?: (text: string, level: number) => string;
    hr?: () => string;
    list?: (body: string, ordered: boolean) => string;
    listitem?: (text: string) => string;
    paragraph?: (text: string) => string;
    table?: (header: string, body: string) => string;
    tablerow?: (content: string) => string;
    tablecell?: (content: string, flags: any) => string;
    strong?: (text: string) => string;
    em?: (text: string) => string;
    codespan?: (code: string) => string;
    br?: () => string;
    del?: (text: string) => string;
    link?: (href: string, title: string | null, text: string) => string;
    image?: (href: string, title: string | null, text: string) => string;
    firstHeading?: (text: string) => string;
    text?: (text: string) => string;
    href?: (href: string) => string;
    [key: string]: any;
  }
  /** Renderer class (default export) */
  export class Renderer {
    constructor(options?: MarkedTerminalOptions, highlightOptions?: any);
  }
  /** Extension factory (named export) - use this with marked.use() */
  export function markedTerminal(
    options?: MarkedTerminalOptions,
    highlightOptions?: any,
  ): MarkedExtension;
  export default Renderer;
}
