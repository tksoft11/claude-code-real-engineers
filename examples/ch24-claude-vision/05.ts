// figma-pipeline.ts — Pipeline สมบูรณ์
import path from 'path';
import fs from 'fs/promises';

interface PipelineOptions {
  mockupsDir: string;      // โฟลเดอร์รูป Figma exports
  outputDir: string;       // โฟลเดอร์สำหรับ output
  projectName: string;
  componentNames?: string[]; // ถ้าไม่ระบุ Claude จะเดาเอง
}

async function runFigmaPipeline(options: PipelineOptions) {
  const { mockupsDir, outputDir, projectName } = options;

  console.log('🎨 Starting Figma-to-Code Pipeline...\n');

  // 1. อ่านรูปทั้งหมด
  const files = await fs.readdir(mockupsDir);
  const pngFiles = files
    .filter(f => f.endsWith('.png') || f.endsWith('.jpg'))
    .map(f => path.join(mockupsDir, f));

  console.log(`📁 Found ${pngFiles.length} mockup files`);

  // 2. Extract Design Tokens จากรูปแรก (ควรเป็น Design System overview)
  console.log('\n🔍 Extracting design tokens...');
  const tokens = await extractDesignTokens(pngFiles[0]);

  // 3. Generate components จากแต่ละรูป
  console.log('\n⚛️  Generating React components...');
  const componentsDir = path.join(outputDir, 'components/ui');
  await fs.mkdir(componentsDir, { recursive: true });

  for (const imagePath of pngFiles.slice(1)) {
    const fileName = path.basename(imagePath, path.extname(imagePath));
    const componentName = toPascalCase(fileName);

    console.log(`  → ${componentName}...`);
    const code = await generateReactComponent(imagePath, componentName, tokens);
    await fs.writeFile(path.join(componentsDir, `${componentName}.tsx`), code);
  }

  // 4. Generate tailwind config จาก tokens
  console.log('\n🎨 Generating Tailwind config...');
  const tailwindConfig = generateTailwindConfig(tokens);
  await fs.writeFile(
    path.join(outputDir, 'tailwind.config.ts'),
    tailwindConfig
  );

  // 5. Generate DESIGN.md
  console.log('\n📄 Generating DESIGN.md...');
  const designMd = await generateDesignMd(pngFiles, projectName);
  await fs.writeFile(path.join(outputDir, 'DESIGN.md'), designMd);

  // 6. Generate CSS variables
  const cssVars = generateCSSVariables(tokens);
  await fs.writeFile(path.join(outputDir, 'src/styles/tokens.css'), cssVars);

  console.log('\n✅ Pipeline complete!');
  console.log(`   Components: ${componentsDir}`);
  console.log(`   DESIGN.md:  ${path.join(outputDir, 'DESIGN.md')}`);
  console.log(`   Tailwind:   ${path.join(outputDir, 'tailwind.config.ts')}`);
}

function generateTailwindConfig(tokens: any): string {
  return `import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary:   '${tokens.colors?.primary || '#1976D2'}',
        secondary: '${tokens.colors?.secondary || '#388E3C'}',
        surface:   '${tokens.colors?.surface || '#FFFFFF'}',
        danger:    '${tokens.colors?.error || '#D32F2F'}',
      },
      fontFamily: {
        sans: ['${tokens.typography?.fontFamily || 'Inter'}', 'sans-serif'],
      },
      borderRadius: ${JSON.stringify(tokens.borderRadius || {})},
    },
  },
  plugins: [],
};

export default config;`;
}

function generateCSSVariables(tokens: any): string {
  const colors = Object.entries(tokens.colors || {})
    .map(([key, value]) => `  --color-${key}: ${value};`)
    .join('\n');

  return `:root {\n${colors}\n}`;
}

function toPascalCase(str: string): string {
  return str.replace(/(^\w|-\w|_\w)/g, m => m.replace(/[-_]/, '').toUpperCase());
}

// รัน pipeline
await runFigmaPipeline({
  mockupsDir: './figma-exports',
  outputDir: './src',
  projectName: 'TechShop UI',
});
