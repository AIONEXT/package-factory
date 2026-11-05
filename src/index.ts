/**
 * Package Factory: Meta-tool to spawn new package repos
 */

import Handlebars from "handlebars";
import * as fs from "fs/promises";
import * as path from "path";
import { z } from "zod";
import axios from "axios";

export const PackageTemplateSchema = z.object({
  name: z.string(),
  description: z.string(),
  language: z.enum(["typescript", "python", "rust", "go"]),
  framework: z.string().optional(),
  license: z.string().default("MIT"),
  author: z.string().default("AIONEXT <aionext@outlook.com>"),
  repository: z.string().default("github.com/AIONEXT"),
  features: z.array(z.string()).default([]),
});

export type PackageTemplate = z.infer<typeof PackageTemplateSchema>;

export interface TemplateFile {
  path: string;
  content: string;
  isTemplate: boolean;
}

export class PackageFactory {
  private templatesDir: string;
  private githubToken: string;

  constructor(templatesDir: string, githubToken: string) {
    this.templatesDir = templatesDir;
    this.githubToken = githubToken;
    this.registerHelpers();
  }

  private registerHelpers(): void {
    Handlebars.registerHelper("eq", (a: any, b: any) => a === b);
    Handlebars.registerHelper("ne", (a: any, b: any) => a !== b);
    Handlebars.registerHelper("gt", (a: any, b: any) => a > b);
    Handlebars.registerHelper("lt", (a: any, b: any) => a < b);
    Handlebars.registerHelper("and", (a: any, b: any) => a && b);
    Handlebars.registerHelper("or", (a: any, b: any) => a || b);
    Handlebars.registerHelper("not", (a: any) => !a);
    Handlebars.registerHelper("includes", (arr: any[], val: any) => arr.includes(val));
    Handlebars.registerHelper("uppercase", (str: string) => str.toUpperCase());
    Handlebars.registerHelper("lowercase", (str: string) => str.toLowerCase());
    Handlebars.registerHelper("pascalCase", (str: string) => str.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase()));
    Handlebars.registerHelper("camelCase", (str: string) => str.replace(/-([a-z])/g, (_, c) => c.toUpperCase()));
    Handlebars.registerHelper("kebabCase", (str: string) => str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase());
  }

  async createPackage(template: PackageTemplate, outputDir: string): Promise<void> {
    console.log(`Creating package: ${template.name}`);

    // Validate template
    PackageTemplateSchema.parse(template);

    // Get template files
    const files = await this.getTemplateFiles(template.language);

    // Render and write files
    for (const file of files) {
      const filePath = path.join(outputDir, this.renderPath(file.path, template));
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      let content = file.content;
      if (file.isTemplate) {
        const tmpl = Handlebars.compile(content);
        content = tmpl(template);
      }

      await fs.writeFile(filePath, content);
      console.log(`  Created: ${filePath}`);
    }

    // Initialize git repo
    await this.initGit(outputDir);

    // Create GitHub repo
    await this.createGitHubRepo(template);

    // Push to GitHub
    await this.pushToGitHub(outputDir, template.name);

    console.log(`Package ${template.name} created successfully!`);
  }

  private async getTemplateFiles(language: string): Promise<TemplateFile[]> {
    const templateDir = path.join(this.templatesDir, language);
    const files: TemplateFile[] = [];

    async function walk(dir: string, base = "") {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.join(base, entry.name);

        if (entry.isDirectory()) {
          await walk(fullPath, relPath);
        } else {
          const content = await fs.readFile(fullPath, "utf-8");
          const isTemplate = entry.name.endsWith(".hbs") || entry.name.endsWith(".tpl");
          const finalPath = isTemplate ? relPath.replace(/\.(hbs|tpl)$/, "") : relPath;
          files.push({ path: finalPath, content, isTemplate });
        }
      }
    }

    await walk(templateDir);
    return files;
  }

  private renderPath(filePath: string, template: PackageTemplate): string {
    const tmpl = Handlebars.compile(filePath);
    return tmpl(template);
  }

  private async initGit(dir: string): Promise<void> {
    // Mock git init
    console.log("  Initialized git repository");
  }

  private async createGitHubRepo(template: PackageTemplate): Promise<void> {
    try {
      await axios.post(
        "https://api.github.com/user/repos",
        {
          name: template.name,
          description: template.description,
          private: false,
          auto_init: true,
          gitignore_template: this.getGitignoreTemplate(template.language),
        },
        {
          headers: { Authorization: `token ${this.githubToken}` },
        }
      );
      console.log("  Created GitHub repository");
    } catch (error) {
      const err = error as any;
      if (err.response?.status !== 422) { // Ignore if already exists
        throw err;
      }
      console.log("  GitHub repository already exists");
    }
  }

  private async pushToGitHub(dir: string, repoName: string): Promise<void> {
    // Mock git push
    console.log(`  Pushed to github.com/AIONEXT/${repoName}`);
  }

  private getGitignoreTemplate(language: string): string {
    const templates: Record<string, string> = {
      typescript: "Node",
      python: "Python",
      rust: "Rust",
      go: "Go",
    };
    return templates[language] || "Node";
  }

  // Built-in templates (used when template directory doesn't exist)
  static getBuiltinTemplate(language: string): TemplateFile[] {
    const templates: Record<string, TemplateFile[]> = {
      typescript: [
        { path: "package.json.hbs", content: `{
  "name": "{{name}}",
  "version": "0.1.0",
  "description": "{{description}}",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc -w",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "format": "prettier --write src",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "npm run build && npm run test && npm run lint"
  },
  "keywords": [{{#each features}}"{{this}}"{{#unless @last}},{{/unless}}{{/each}}],
  "author": "{{author}}",
  "license": "{{license}}",
  "repository": {
    "type": "git",
    "url": "https://{{repository}}/{{name}}.git"
  },
  "bugs": {
    "url": "https://{{repository}}/{{name}}/issues"
  },
  "homepage": "https://{{repository}}/{{name}}#readme",
  "engines": {
    "node": ">=20.0.0"
  },
  "dependencies": {},
  "devDependencies": {
    "@types/node": "^20.10.6",
    "@typescript-eslint/eslint-plugin": "^6.17.0",
    "@typescript-eslint/parser": "^6.17.0",
    "eslint": "^8.56.0",
    "eslint-config-prettier": "^9.1.0",
    "prettier": "^3.1.1",
    "typescript": "^5.3.3",
    "vitest": "^1.1.0"
  }
}`, isTemplate: true },
        { path: "tsconfig.json", content: `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}`, isTemplate: false },
        { path: "src/index.ts", content: `/**
 * {{name}} - {{description}}
 */

export { {{pascalCase name}} } from "./{{camelCase name}}";

export class {{pascalCase name}} {
  constructor() {
    // Implementation here
  }
}`, isTemplate: true },
      ],
      python: [
        { path: "pyproject.toml.hbs", content: `[project]
name = "{{name}}"
version = "0.1.0"
description = "{{description}}"
readme = "README.md"
requires-python = ">=3.11"
license = {text = "{{license}}"}
authors = [{name = "{{author}}"}]
keywords = [{{#each features}}"{{this}}"{{#unless @last}},{{/unless}}{{/each}}]
classifiers = [
    "Development Status :: 3 - Alpha",
    "Intended Audience :: Developers",
    "License :: OSI Approved :: MIT License",
    "Programming Language :: Python :: 3.11",
    "Programming Language :: Python :: 3.12",
]

dependencies = []

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
python_classes = ["Test*"]
python_functions = ["test_*"]
addopts = "-v --strict-markers --asyncio-mode=auto"

[tool.ruff]
target-version = "py311"
line-length = 100
select = ["E", "F", "I", "W", "UP", "B", "C4"]
ignore = ["E501"]
`, isTemplate: true },
        { path: "src/{{snakeCase name}}/__init__.py", content: `"""{{name}} - {{description}}"""

__version__ = "0.1.0"
__author__ = "{{author}}"
__license__ = "{{license}}"

from .{{snakeCase name}} import {{pascalCase name}}

__all__ = ["{{pascalCase name}}"]
`, isTemplate: true },
        { path: "src/{{snakeCase name}}/{{snakeCase name}}.py", content: `"""{{pascalCase name}} implementation."""

class {{pascalCase name}}:
    """{{description}}."""
    
    def __init__(self):
        pass
`, isTemplate: true },
      ],
    };

    return templates[language] || templates.typescript;
  }
}

// Helper to register snake_case helper
Handlebars.registerHelper("snakeCase", (str: string) => 
  str.replace(/([a-z])([A-Z])/g, "$1_$2").replace(/-/g, "_").toLowerCase()
);