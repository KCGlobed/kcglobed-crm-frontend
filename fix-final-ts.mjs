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

// 1. MetaComponent state.course
replaceInFile('src/components/components/MetaComponent/index.tsx', /const \{ data: courseData \} = useAppSelector\(\(state\) => state\.course\);/, 'const { data: courseData } = useAppSelector((state: any) => state.course || { data: [] });');

// 2. MultiStepForm updateData
replaceInFile('src/utils/types.ts', /data\?: any;/, 'data?: any;\n  updateData?: any;');

// 3. MultiStepForm MultiStepForm/index.tsx(76,11): error TS2353: Object literal may only specify known properties, and 'updateData' does not exist in type 'StepProps'. (Actually already covered by StepProps edit above)
