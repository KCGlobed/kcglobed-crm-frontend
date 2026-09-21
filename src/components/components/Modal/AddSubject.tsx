import Select from "react-select";
import { useForm, Controller } from "react-hook-form";
import { createSubject, fetchSubjectList } from "../../services/phaseTwoService";
import { useEffect, useState } from "react";
import { viewCourseApi } from "../../services/courseService";
import { useModal } from "../../context/ModalContext";

type SubjectOption = {
    value: number;
    label: string;
};

type FormValues = {
    subjects: SubjectOption[];
};

const AddSubject = ({ courseId }: { courseId: number }) => {
    const [subjectData, setSubjectData] = useState<SubjectOption[]>([])
    const [loading, setLoading] = useState(true);
    const { hideModal } = useModal();

    const {
        control,
        handleSubmit,
        setValue,
        formState: { errors },
    } = useForm<FormValues>({
        defaultValues: {
            subjects: [],
        },
    });

    const onSubmit = async (data: FormValues) => {
        console.log("Course ID:", courseId);
        console.log("Selected Subjects:", data.subjects);

        // backend payload example
        const payload = {
            subject_id: data.subjects.map((s) => s.value),
        };
        await createSubject(courseId, payload);
        hideModal()
    };

    // Fetch all available subjects for dropdown options
    const handleFetchSubjectList = async () => {
        try {
            const subjects = await fetchSubjectList();
            const subjectOptions = subjects.map((subject: any) => ({
                value: subject.id,
                label: subject.name,
            }));
            setSubjectData(subjectOptions);

        } catch (error) {
            console.error("Error fetching subject list:", error);
        }
    };

    // Fetch existing subjects assigned to this course
    const loadExistingSubjects = async () => {
        try {
            const response = await viewCourseApi(courseId);
            console.log(response.data.subject_info, "Existing Course Subjects");

            if (response.data.subject_info && response.data.subject_info.length > 0) {
                const existingSubjects = response.data.subject_info.map((subject: any) => ({
                    value: subject.subject_detail[0].id,
                    label: subject.subject_detail[0].name,
                }));
                // Pre-populate the form with existing subjects
                setValue("subjects", existingSubjects);
            }
        } catch (error) {
            console.error("Error fetching existing subjects:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const loadData = async () => {
            await handleFetchSubjectList(); // Load all available subjects
            await loadExistingSubjects();   // Load existing course subjects
        };
        loadData();
    }, [courseId]);

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subjects</label>

                {loading ? (
                    <div className="text-center py-4 text-gray-500">Loading subjects...</div>
                ) : (
                    <Controller
                        name="subjects"
                        control={control}
                        rules={{
                            validate: (value) =>
                                value.length > 0 || "At least one subject is required",
                        }}
                        render={({ field }) => (
                            <Select
                                {...field}
                                options={subjectData}
                                placeholder="Select subjects"
                                isMulti
                                closeMenuOnSelect={false}
                            />
                        )}
                    />
                )}

                {errors.subjects && (
                    <p style={{ color: "red", fontSize: "12px" }}>
                        {errors.subjects.message}
                    </p>
                )}
            </div>

            <button
                type="submit"
                className="bg-blue-600 w-full mt-5 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
            >
                Add Subjects
            </button>
        </form>
    );
};

export default AddSubject;
