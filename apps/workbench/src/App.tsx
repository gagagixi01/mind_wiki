import { APP_NAME } from "@mind-wiki/core";

export function App() {
  return (
    <main className="workbench-shell">
      <section className="workbench-panel">
        <p className="eyebrow">本地工作台 · 不发布</p>
        <h1>{APP_NAME} Curation Workbench</h1>
        <p>
          本地策展状态、抽取产物、无效草稿、运行日志和凭据保留在本机边界内。
        </p>
      </section>
    </main>
  );
}
