import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

await rm("dist", { force: true, recursive: true });

execFileSync("npx", ["--yes", "-p", "typescript", "tsc", "-p", "tsconfig.build.json"], {
  stdio: "inherit",
});

await mkdir("dist/app", { recursive: true });
await copyFile("src/app/styles.css", "dist/app/styles.css");

const indexHtml = await readFile("index.html", "utf8");
const deployIndexHtml = indexHtml
  .replace("./src/app/styles.css", "./app/styles.css")
  .replace("./dist/app/menuPage.js", "./app/menuPage.js");

await writeFile("dist/index.html", deployIndexHtml);
