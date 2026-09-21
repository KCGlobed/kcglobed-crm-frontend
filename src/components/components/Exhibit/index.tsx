import React, { useState } from 'react';
import type { StepProps } from '../../utils/types';
import { apiRequest } from '../../services/apiRequest';
import { useAppDispatch, useAppSelector } from '../../hooks/useRedux';
import { addExhibit, removeExhibit } from '../../store/slices/exhibitSlice';
import { useAlert } from '../../context/AlertContext';

interface FileWithUrl {
  url: string;
  file: File;
}

const Exhibit: React.FC<StepProps> = ({ onDemandQuestionSave }) => {
  const [files, setFiles] = useState<FileWithUrl[]>([]);
  const simulationId = useAppSelector((state) => state.meta.simulationId);
  const exhibits = useAppSelector((state) => state.exhibit.exhibits);
  const dispatch = useAppDispatch();
  const { showAlert } = useAlert();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const selectedFiles = Array.from(event.target.files).map((file) => ({
        file,
        url: URL.createObjectURL(file),
      }));
      setFiles((prev) => [...prev, ...selectedFiles]);
    }
  };

  const handleUpload = async () => {
    if (simulationId) {
      uploadAllFiles(simulationId);
    } else {
      if (onDemandQuestionSave) {
        const simulation_id = await onDemandQuestionSave();
        if (simulation_id) {
          uploadAllFiles(simulation_id);
        }
      }
    }
  };

  const uploadAllFiles = async (simId: string) => {
    for (let i = 0; i < files.length; i++) {
      const formData = new FormData();
      formData.append('simulation_id', simId);
      formData.append('title', `Exhibit_${i + 1}`);
      formData.append('exhibits_file', files[i].file);
      try {
        await apiRequest<{ id: number; name: string; exhibits_file: string }>(
          'assessment/update-exhibits/',
          'POST',
          formData
        );

        showAlert("Exhibit Uploaded Successfully...", 'success');

        const uploadeed = {
          name: files[i].file.name,
          exhibits_file: '',
        }

        dispatch(addExhibit(uploadeed));
      } catch (e) {
        showAlert("Something went wrong ...", 'error');
      }

    }
    setFiles([]);
  }

  const handleFileRemove = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleDeleteExhibits = async (id: number) => {
  try {
    await apiRequest<void>(`assessment/delete-exhibits/${id}`, 'DELETE');
    dispatch(removeExhibit(id));
  } catch (error) {
    console.error("Failed to delete exhibit:", error);
  }
 };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <input
          type="file"
          multiple
          onChange={handleFileChange}
          className="w-full rounded border border-gray-300 px-4 py-2 text-sm file:mr-4 file:rounded file:border-0 file:bg-blue-500 file:px-4 file:py-2 file:text-white hover:file:bg-blue-600"
        />
        <button
          onClick={handleUpload}
          className="rounded w-50 h-13 bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 cursor-pointer"
        >
          Upload
        </button>
      </div>

      {files.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mt-6">Files to Upload</h2>
          <ul className="flex flex-wrap gap-4">
            {files.map((file, index) => (
              <li
                key={index}
                className="flex size-[250px] flex-col justify-between rounded border border-gray-300 bg-white p-2 shadow hover:bg-gray-50"
              >
                <object className="h-[91%] w-full" data={file.url} type="application/pdf" />
                <div className="flex items-center justify-between pt-2 text-sm">
                  <span className="truncate">{file.file.name}</span>
                  <button
                    onClick={() => handleFileRemove(index)}
                    className="text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-2">Uploaded Exhibits</h2>
        <ul className="flex flex-wrap gap-4">
          {exhibits.map((item) => (
            <li
              key={item.id}
              className="relative flex flex-col justify-between rounded border border-gray-300 bg-white p-2 shadow hover:bg-gray-50"
            >
              {/* Cross Icon Button */}
              <button
                // onClick={() => handleDelete(item.id)}
                className="absolute top-[-10px] right-[-13px] p-1 text-gray-400  hover:text-red-500 "
                 onClick={() => item.id !== undefined && handleDeleteExhibits(item.id)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <circle cx="12" cy="12" r="10" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 9l-6 6m0-6l6 6" />
                </svg>
              </button>

              {/* Item Name */}
              <div className="text-sm pt-2 truncate">{item.name}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Exhibit;