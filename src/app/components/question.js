export default function Question({text, handleQuickSend}){
    return(
        <span className="border-info border rounded-3xl px-3 py-1 whitespace-nowrap cursor-help" onClick={() => handleQuickSend(text)}>{text}</span>
    )
}