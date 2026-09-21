import type { Essay } from "../../utils/types";
import Toggle from "../Toggle";


interface EssayTableProps {
  essays: Essay[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onToggle?:(id: string,status:number) => void
}

export default function EssayTable({
  essays,
  onEdit,
  onDelete,
  onToggle,
}: EssayTableProps) {
  
  return (
    <div className="overflow-auto custom-scrollbar bg-white rounded-xl shadow-md border border-gray-200 max-h-[75vh]" style={{ overscrollBehaviorY: 'contain', overscrollBehaviorX: 'none' }}>
      <table className="w-full min-w-[900px] border-separate border-spacing-0">
        <thead className="bg-gray-50 text-sm text-gray-700">
          <tr>
            <th className="sticky top-0 z-10 bg-gray-50 px-6 py-3 text-left font-semibold border-b border-gray-200">Essay ID</th>
            <th className="sticky top-0 z-10 bg-gray-50 px-6 py-3 text-left font-semibold border-b border-gray-200">Question ID</th>
            <th className="sticky top-0 z-10 bg-gray-50 px-6 py-3 text-left font-semibold border-b border-gray-200">Subject</th>
            <th className="sticky top-0 z-10 bg-gray-50 px-6 py-3 text-left font-semibold border-b border-gray-200">Chapter</th>
            <th className="sticky top-0 z-10 bg-gray-50 px-6 py-3 text-left font-semibold border-b border-gray-200">Visible</th>
            <th className="sticky top-0 z-10 bg-gray-50 px-6 py-3 text-left font-semibold border-b border-gray-200">Actions</th>
          </tr>
        </thead>
        <tbody className="text-sm text-gray-600 divide-y divide-gray-100">
          {essays.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center py-6 text-gray-400">
                No essays found.
              </td>
            </tr>
          ) : (
            essays.map((essay) => (
              <tr key={essay.id} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4">{essay.id}</td>
                <td className="px-6 py-4">{essay.idnumber}</td>
                <td className="px-6 py-4">{essay.subject.name}</td>
                <td className="px-6 py-4">{essay.chapter.name}</td>
                <td className="px-6 py-4 cursor-pointer font-bold" onClick={() => onToggle?.(essay.id,essay.visible)}><Toggle enabled={essay.visible}label="" /> </td>
                <td className="space-x-2 flex items-center p-4">
                  <button
                    onClick={() => onEdit?.(essay.id)}
                    className="px-3 py-1 cursor-pointer rounded-md text-sm font-medium bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800 transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete?.(essay.id)}
                    className="px-3 py-1 cursor-pointer rounded-md text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800 transition"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
