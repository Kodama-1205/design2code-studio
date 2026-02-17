import { buildSnapshotHash, fetchFigmaNodeImage } from "@/lib/figma";

export async function runFigmaPipeline(input: {
  ownerId: string;
  figmaFileKey: string;
  figmaNodeId: string;
  sourceUrl: string;
  profileOverrideId?: string;
  projectId: string;
  generationId: string;
  figmaToken: string;
}) {
  console.log("Figma pipeline start", { fileKey: input.figmaFileKey, nodeId: input.figmaNodeId });
  // レート制限対策: MVPでは nodes 取得を省略し、画像取得を優先する（呼び出し回数を半減）
  const image = await fetchFigmaNodeImage({
    ownerId: input.ownerId,
    fileKey: input.figmaFileKey,
    nodeId: input.figmaNodeId,
    token: input.figmaToken
  });
  const snapshotHash = buildSnapshotHash({
    fileKey: input.figmaFileKey,
    nodeId: input.figmaNodeId,
    sourceUrl: input.sourceUrl
  });

  if (!image) {
    // Figmaモードでは「画像が取れない=結果が判別できない」ので失敗扱いにする
    throw new Error(
      "Figma画像の取得に失敗しました。対象のnode-idがFrameであることを確認し、しばらく待ってから再実行してください。（レート制限の可能性があります）"
    );
  }

  const nodeName = `Figma ${input.figmaNodeId}`;

  const ir = {
    irVersion: "1.0",
    source: {
      tool: "figma",
      fileKey: input.figmaFileKey,
      nodeId: input.figmaNodeId,
      nodeName,
      url: input.sourceUrl,
      fetchedAt: new Date().toISOString(),
      snapshotHash
    },
    assets: image
      ? [
          {
            id: "figma-node-image",
            name: `${nodeName}.png`,
            mime: image.mime,
            nodeId: input.figmaNodeId
          }
        ]
      : [],
    components: [],
    page: {
      name: "Figma File",
      root: {
        id: "n_root",
        figmaNodeId: input.figmaNodeId,
        name: nodeName,
        kind: "image",
        layout: { type: "absolute" },
        style: {}
      }
    },
    meta: {
      generator: "Design2Code Studio",
      profile: {
        mode: "production",
        outputTarget: "nextjs_tailwind",
        useShadcn: true,
        stylingStrategy: "tailwind_only",
        namingConvention: "camel",
        tokenClusterThreshold: 0.12
      }
    }
  };

  const report = {
    summary: {
      tokenCoverageEstimate: 0,
      absoluteUsageEstimate: 0,
      duplicationCandidates: 0
    },
    unsupported: [],
    notes: [
      "プレビュー画像を取得しました。"
    ]
  };

  const files = buildFigmaGeneratedProject(input.sourceUrl, image);

  const mappings: Array<{
    figma_node_id: string;
    figma_node_name: string | null;
    target_path: string;
    target_symbol: string | null;
    loc_start: number | null;
    loc_end: number | null;
    mapping_type: "component" | "asset";
  }> = [
    {
      figma_node_id: input.figmaNodeId,
      figma_node_name: nodeName,
      target_path: "app/page.tsx",
      target_symbol: "Page",
      loc_start: 1,
      loc_end: 120,
      mapping_type: "component" as const
    }
  ];

  if (image) {
    mappings.push({
      figma_node_id: input.figmaNodeId,
      figma_node_name: nodeName,
      target_path: "public/figma-node.png",
      target_symbol: null,
      loc_start: null,
      loc_end: null,
      mapping_type: "asset" as const
    });
  }

  return {
    snapshotHash,
    ir,
    report,
    profileSnapshot: ir.meta.profile,
    files,
    mappings
  };
}

function buildFigmaGeneratedProject(sourceUrl: string, image: { mime: string; base64: string } | null) {
  const readme = `# Design2Code Studio により生成

これは Figma から生成したプロジェクト雛形です。

- ソース: ${sourceUrl}

次のステップ:
- 実Figma取得 → IR → コード生成へ置き換えてください。
`;

  const pkg = `{
  "name": "generated-design2code",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "14.2.14",
    "react": "18.3.1",
    "react-dom": "18.3.1"
  }
}
`;

  const nextConfig = `/** @type {import('next').NextConfig} */
const nextConfig = { reactStrictMode: true };
export default nextConfig;
`;

  const globals = `html, body { height: 100%; }
body { margin: 0; font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, "Noto Sans JP", sans-serif; }
`;

  const layout = `export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
`;

  const page = `export default function Page() {
  return (
    <main style={{ minHeight: "100vh", background: "#121218", color: "#F5F5FA", padding: 24 }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <h1 style={{ color: "#AA5AFF", fontSize: 28, lineHeight: "36px", margin: 0 }}>
          Generated — Design2Code Studio
        </h1>
        <p style={{ opacity: 0.8, marginTop: 12 }}>
          これは Figma から生成した雛形です。
        </p>
        ${image ? `<img src="/figma-node.png" alt="Figma Node" style={{ marginTop: 16, maxWidth: "100%" }} />` : ""}
        <div style={{ marginTop: 20, padding: 16, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>ソース</div>
          <div style={{ marginTop: 6, wordBreak: "break-all" }}>${sourceUrl}</div>
        </div>
      </div>
    </main>
  );
}
`;

  type GeneratedFile = { path: string; content: string; kind: "config" | "code" | "style" | "asset" };
  const files: GeneratedFile[] = [
    { path: "README.md", content: readme, kind: "config" as const },
    { path: "package.json", content: pkg, kind: "config" as const },
    { path: "next.config.mjs", content: nextConfig, kind: "config" as const },
    { path: "app/layout.tsx", content: layout, kind: "code" as const },
    { path: "app/page.tsx", content: page, kind: "code" as const },
    { path: "app/globals.css", content: globals, kind: "style" as const }
  ];

  if (image) {
    files.push({
      path: "public/figma-node.png",
      content: `data:${image.mime};base64,${image.base64}`,
      kind: "asset" as const
    });
  }

  return files;
}
