import fs from 'fs';
import path from 'path';

function replaceInFile(filePath, searchRegex, replaceValue) {
  const absolutePath = path.resolve(filePath);
  if (fs.existsSync(absolutePath)) {
    let content = fs.readFileSync(absolutePath, 'utf8');
    content = content.replace(searchRegex, replaceValue);
    fs.writeFileSync(absolutePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

// 1. Types duplicate Essay
replaceInFile('src/utils/types.ts', /export interface Essay \{ id: string; \[key: string\]: any; \}\r?\n\r?\nexport interface Essay \{ id: string; \[key: string\]: any; \}/, 'export interface Essay { id: string; [key: string]: any; }');

// 2. CropperModal unused setJpegQuality
replaceInFile('src/components/components/ImageCropper/components/CropperModal.tsx', /const \[jpegQuality, setJpegQuality\] = useState\(1\);/, 'const [jpegQuality] = useState(1);');

// 3. MetaComponent unused course property
replaceInFile('src/components/components/MetaComponent/index.tsx', /state\.meta\.course/g, 'state.meta');
replaceInFile('src/components/components/MetaComponent/index.tsx', /c\.id == metaData\.courseId/g, 'String(c.id) == String(metaData.courseId)');
replaceInFile('src/components/components/MetaComponent/index.tsx', /s\.id == metaData\.subjectId/g, 'String(s.id) == String(metaData.subjectId)');

// 4. StatusConfirmationModal unused toast
replaceInFile('src/components/components/Modal/StatusConfirmationModal.tsx', /import toast from 'react-hot-toast';/, '');
replaceInFile('src/components/components/Modal/StatusConfirmationModal.tsx', /toast,/, '');

// 5. MultiStepForm 'data' does not exist in type 'StepProps'
replaceInFile('src/utils/types.ts', /stepKey\?: string;/, 'stepKey?: string;\n  data?: any;');

// 6. ReportFilter unused MultiValue
replaceInFile('src/components/components/ReportComponent/reportFilter.tsx', /import \{.*MultiValue.*\} from 'react-select';/, "import { ActionMeta } from 'react-select';");

// 7. TextEditor/index.tsx fn?.()
replaceInFile('src/components/components/TextEditor/index.tsx', /const importer = fn\(importNode\);/, 'const importer = fn?.(importNode);');

// 8. TextEditor/utils/utils.ts erasableSyntaxOnly
replaceInFile('src/components/components/TextEditor/utils/utils.ts', /as const;/g, 'as any;');

// 9. courseService / phaseTwoService courseId
replaceInFile('src/services/courseService.ts', /courseId: any/, '_courseId: any');
replaceInFile('src/services/phaseTwoService.ts', /courseId: any/, '_courseId: any');
