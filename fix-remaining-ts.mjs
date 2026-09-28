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

// EditEssayQuestion
replaceInFile('src/components/components/EditEssayQuestion/index.tsx', /addSubQuestion\(\)/g, 'addSubQuestion({ id: Date.now().toString(), question: "", answer: "" })');

// PollComponent
replaceInFile('src/components/components/TextEditor/nodes/PollComponent.tsx', /const \{clientID\} = useCollaborationContext\(\);/g, 'const {clientID} = useCollaborationContext() as any;');

// CommentPlugin
replaceInFile('src/components/components/TextEditor/plugins/CommentPlugin/index.tsx', /const node: null \| MarkNode = \$getNodeByKey\(key\);/g, 'const node = $getNodeByKey(key);');

// InlineImageComponent
replaceInFile('src/components/components/TextEditor/nodes/InlineImageNode/InlineImageComponent.tsx', /KEY_ENTER_COMMAND,\s*\$onEnter,/g, 'KEY_ENTER_COMMAND as any, $onEnter,');
