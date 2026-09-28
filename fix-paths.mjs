import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filesToFixComponents = [
  'src/components/components/DashboardHeader/index.tsx',
  'src/components/components/EditEssayQuestion/index.tsx',
  'src/components/components/EssayTable/index.tsx',
  'src/components/components/Exhibit/index.tsx',
  'src/components/components/MetaComponent/index.tsx',
  'src/components/components/Modal/AddSubject.tsx',
  'src/components/components/MultiStepForm/index.tsx',
  'src/components/components/PreviewEssayEdit/index.tsx'
];

filesToFixComponents.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf-8');
    // Keep the quote
    content = content.replace(/from\s+(['"])\.\.\/\.\.\/(hooks|store|utils|services|context)/g, "from $1../../../$2");
    content = content.replace(/import\s+(['"])\.\.\/\.\.\/(hooks|store|utils|services|context)/g, "import $1../../../$2");
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Fixed ${file}`);
  }
});

const filesToFixTextEditor = [
  'src/components/components/TextEditor/nodes/PollComponent.tsx',
  'src/components/components/TextEditor/ui/Button.tsx'
];

filesToFixTextEditor.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf-8');
    content = content.replace(/(['"])\.\.\/\.\.\/\.\.\/utils\/joinClasses['"]/g, "$1../../../../utils/joinClasses$1");
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Fixed ${file}`);
  }
});
