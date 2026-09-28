export default function joinClasses(...args: (string | boolean | undefined | null)[]): string {
  return args.filter(Boolean).join(' ');
}
