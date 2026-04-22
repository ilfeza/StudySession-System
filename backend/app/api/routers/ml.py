from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_current_user
from app.ml.analyzer import MaterialAnalyzer
from app.schemas import MaterialAnalysisResponse, SummaryRequest, SummaryResponse

router = APIRouter()
analyzer = MaterialAnalyzer()


@router.post('/summarize', response_model=SummaryResponse)
def summarize(payload: SummaryRequest, _=Depends(get_current_user)):
    try:
        summary = analyzer.summarize(payload.text)
    except Exception as exc:
        raise HTTPException(status_code=500, detail='Не удалось выполнить суммаризацию.') from exc
    return SummaryResponse(summary=summary)


@router.post('/analyze', response_model=MaterialAnalysisResponse)
def analyze(payload: SummaryRequest, _=Depends(get_current_user)):
    try:
        key_ideas, category, confidence = analyzer.analyze_material(payload.text)
    except Exception as exc:
        raise HTTPException(status_code=500, detail='Не удалось выполнить анализ материала.') from exc
    return MaterialAnalysisResponse(key_ideas=key_ideas, category=category, confidence=confidence)
