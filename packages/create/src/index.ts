import { execa } from "execa";
import kleur from "kleur";
import { detectFramework } from "./detect.js";
import { runPrompts } from "./prompts.js";
import { scaffoldProject } from "./scaffold.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] ?? "init";

  if (command !== "init") {
    console.error(kleur.red(`Unknown command: ${command}. Try 'init'.`));
    process.exit(1);
  }

  const cwd = process.cwd();
  console.log(kleur.cyan("markdown-edge-for-agents"));
  console.log(kleur.gray("Detectando framework..."));

  const detected = detectFramework(cwd);
  console.log(kleur.gray(`Detectado: ${kleur.bold(detected)}`));

  const answers = await runPrompts({ detectedFramework: detected });

  console.log(kleur.gray("Gerando arquivos..."));
  const workerDir = scaffoldProject({
    cwd,
    workerPath: answers.workerPath,
    workerName: answers.workerName,
    preset: answers.preset,
    zone: answers.zone,
    patterns: [answers.pattern],
    selector: null,
    strip: null,
    redirects: null,
  });

  console.log(kleur.green(`Criado em ${workerDir}`));
  console.log(kleur.gray("Instalando deps..."));
  try {
    await execa("npm", ["install"], { cwd: workerDir, stdio: "inherit" });
  } catch {
    console.log(kleur.yellow(`npm install falhou. Rode manualmente em ${workerDir}`));
  }

  console.log();
  console.log(kleur.green("Pronto!"));
  console.log();
  console.log("Proximos passos:");
  console.log(kleur.gray(`  cd ${answers.workerPath}`));
  console.log(kleur.gray("  npx wrangler login"));
  console.log(kleur.gray("  npx wrangler deploy"));
  console.log();
}

main().catch((err) => {
  console.error(kleur.red(err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
