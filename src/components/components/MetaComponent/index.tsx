import React, { useEffect, useState } from "react";
import { useAppSelector } from "../../hooks/useRedux";
import { useAppDispatch } from "../../hooks/useAppDispatch";
import { updateMeta } from "../../store/slices/metaSlice";
import type { StepProps } from "../../utils/types";

type Course = {
  id: number;
  full_name: string;
  shortname: string;
  subjects: Subject[];
};

type Subject = {
  id: number;
  name: string;
  chapter: Chapter[];
};

type Chapter = {
  id: number;
  name: string;
};

const MetaComponent: React.FC<StepProps> = () => {
  const dispatch = useAppDispatch();
  const metaData = useAppSelector((state) => state.meta);
  const { data: courseData } = useAppSelector((state) => state.course);

  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  useEffect(() => {
    const foundCourse = courseData.find((c:Course) => c.id == metaData.courseId);
    setSelectedCourse(foundCourse ?? null);

    if (foundCourse && metaData.subjectId) {
      const foundSubject = foundCourse.subjects.find((s:Subject) => s.id == metaData.subjectId);
      setSelectedSubject(foundSubject ?? null);
    } else {
      setSelectedSubject(null);
    }
  }, [metaData.courseId, metaData.subjectId, courseData]);

  const handleCourseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const courseId = e.target.value;
    const course = courseData.find((c:Course) => c.id === parseInt(courseId));
    setSelectedCourse(course ?? null);
    setSelectedSubject(null);
    dispatch(updateMeta({ courseId }));
  };

  const handleSubjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const subjectId = e.target.value;
    const subject = selectedCourse?.subjects.find((s) => s.id === parseInt(subjectId));
    setSelectedSubject(subject ?? null);
    dispatch(updateMeta({ subjectId }));
  };

  const handleChapterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch(updateMeta({ chapterId: e.target.value }));
  };

  const handleDifficultyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch(updateMeta({ difficulty_level: e.target.value as "low" | "medium" | "high" }));
  };

  const handlePassPercentageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "" || Number(val) <= 100) {
      dispatch(updateMeta({ pass_percentage: val}));
    }
    
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Question ID</label>
        <input
          type="text"
          value={metaData.questionId || ""}
          onChange={(e) => dispatch(updateMeta({ questionId: e.target.value }))}
          className="w-full px-4 py-2 border rounded-lg"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Select Course</label>
        <select
          disabled
          value={metaData.courseId || ""}
          onChange={handleCourseChange}
          className="w-full px-4 py-2 border rounded-lg opacity-50"
        >
          <option value="">-- Select Course --</option>
          {courseData.map((course: Course) => (
            <option key={course.id} value={course.id}>
              {course.full_name}
            </option>
          ))}
        </select>
      </div>

      {selectedCourse && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Select Subject</label>
          <select
            value={metaData.subjectId || ""}
            onChange={handleSubjectChange}
            className="w-full px-4 py-2 border rounded-lg"
          >
            <option value="">-- Select Subject --</option>
            {selectedCourse.subjects.map((subj) => (
              <option key={subj.id} value={subj.id}>
                {subj.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedSubject && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Select Chapter</label>
          <select
            value={metaData.chapterId || ""}
            onChange={handleChapterChange}
            className="w-full px-4 py-2 border rounded-lg"
          >
            <option value="">-- Select Chapter --</option>
            {selectedSubject.chapter.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Difficulty Level</label>
        <select
          value={metaData.difficulty_level || "low"}
          onChange={handleDifficultyChange}
          className="w-full px-4 py-2 border rounded-lg"
        >
          <option value="low">LOW</option>
          <option value="medium">MEDIUM</option>
          <option value="high">HIGH</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Pass Percentage (%)</label>
        <input
          type="number"
          value={metaData.pass_percentage || ""}
          onChange={handlePassPercentageChange}
          placeholder="Enter Pass Percentage"
          className="w-full px-4 py-2 border rounded-lg"
        />
      </div>
    </div>
  );
};

export default MetaComponent;
