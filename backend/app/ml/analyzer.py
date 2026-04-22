from __future__ import annotations

import re
from collections import Counter

try:
    from transformers import pipeline
except Exception:  # pragma: no cover
    pipeline = None


class MaterialAnalyzer:
    def __init__(self):
        self._summarizer = None
        if pipeline:
            try:
                self._summarizer = pipeline('summarization', model='IlyaGusev/rut5_base_sum_gazeta')
            except Exception:
                self._summarizer = None

    def summarize(self, text: str) -> str:
        clean = ' '.join(text.split())
        if self._summarizer:
            try:
                result = self._summarizer(clean, max_length=120, min_length=35, do_sample=False)
                summary = result[0]['summary_text'].strip()
                if summary:
                    return summary
            except Exception:
                pass
        return self._extractive_summary(clean)

    def analyze_material(self, text: str) -> tuple[list[str], str, float]:
        key_ideas = self._extract_key_ideas(text)
        category, confidence = self._classify(text)
        return key_ideas, category, confidence

    def _extractive_summary(self, text: str) -> str:
        sentences = re.split(r'(?<=[.!?])\s+', text)
        sentences = [s.strip() for s in sentences if len(s.strip()) > 20]
        if len(sentences) <= 2:
            return text[:700]

        tokenized = [re.findall(r'[А-Яа-яA-Za-z]{4,}', sentence.lower()) for sentence in sentences]
        global_freq = Counter(token for row in tokenized for token in row)

        scored: list[tuple[float, int]] = []
        for idx, row in enumerate(tokenized):
            if not row:
                continue
            score = sum(global_freq[token] for token in row) / max(len(row), 1)
            scored.append((score, idx))

        top_idx = [idx for _, idx in sorted(scored, reverse=True)[:3]]
        selected = [sentences[i] for i in sorted(top_idx)]
        return ' '.join(selected)

    def _extract_key_ideas(self, text: str) -> list[str]:
        tokens = re.findall(r'[А-Яа-яA-Za-z]{4,}', text.lower())
        stop_words = {
            'который', 'также', 'чтобы', 'если', 'или', 'при', 'для', 'быть',
            'это', 'этого', 'после', 'между', 'может', 'нужно', 'проект',
        }
        filtered = [t for t in tokens if t not in stop_words]
        top_words = [word for word, _ in Counter(filtered).most_common(8)]
        if not top_words:
            return ['Не удалось выделить ключевые идеи автоматически.']
        return [f'Ключевая тема: {word}' for word in top_words[:5]]

    def _classify(self, text: str) -> tuple[str, float]:
        catalog = {
            'программирование': ['python', 'алгоритм', 'код', 'backend', 'frontend', 'fastapi'],
            'математика': ['интеграл', 'матрица', 'вероятность', 'теорема', 'функция'],
            'менеджмент': ['планирование', 'срок', 'команда', 'риски', 'ресурсы'],
            'научная работа': ['гипотеза', 'эксперимент', 'исследование', 'данные', 'вывод'],
        }
        lower = text.lower()
        best = ('общее', 0.45)
        for category, words in catalog.items():
            hits = sum(1 for word in words if word in lower)
            confidence = min(0.98, 0.5 + hits * 0.1)
            if hits > 0 and confidence > best[1]:
                best = (category, confidence)
        return best
