import { useAppSelector } from "../../hooks/useRedux";
import type { StepProps } from "../../utils/types";


const PreviewEssayEdit: React.FC<StepProps> = () => {

    const { description, subQuestions } = useAppSelector((state) => state.question);

    return (
        <>
            <h1>Preview Essay Type</h1>

            <div dangerouslySetInnerHTML={{ __html: description }}></div>

            {subQuestions?.map(({ question, answer, id }) => (
                <div key={id}>
                    <div className="question-section">
                        <h3>Question:</h3>
                        <div dangerouslySetInnerHTML={{ __html: question }}></div>
                    </div>
                    <div className="answer-section">
                        <h3>Answer:</h3>
                        <div dangerouslySetInnerHTML={{ __html: answer }}></div>
                    </div>
                </div>
            ))}
        </>
    )
}

export default PreviewEssayEdit;