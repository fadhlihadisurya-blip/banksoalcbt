export interface LiveScoreComputationInput {
  session?: any;
  result?: any;
  packageQuestions?: any[];
  allQuestions: any[];
  exam: any;
}

export interface LiveScoreComputationResult {
  liveScore: number | null;
  liveCorrectCount: number;
  isFinal: boolean;
}

function getQuestionWeight(master: any, pq: any, exam: any): number {
  const cogLevel = master?.cognitiveLevel || pq?.cognitiveLevel || 'MOTS';
  const configuredWeight = exam?.scoringConfig?.weights?.[cogLevel];
  if (typeof configuredWeight === 'number' && !Number.isNaN(configuredWeight) && configuredWeight >= 0) {
    return configuredWeight;
  }
  return Number(master?.points || pq?.points) || 10;
}

export function computeLiveStudentScore({
  session,
  result,
  packageQuestions,
  allQuestions,
  exam,
}: LiveScoreComputationInput): LiveScoreComputationResult {
  if (result && typeof result.finalScore === 'number') {
    return {
      liveScore: result.finalScore,
      liveCorrectCount: Number(result.correctCount) || 0,
      isFinal: true,
    };
  }

  if (!session || session.status === 'not_started') {
    return {
      liveScore: null,
      liveCorrectCount: 0,
      isFinal: false,
    };
  }

  const answers: Record<string, any> = session.answers || {};
  const questionMap = new Map<string, any>();
  for (const q of allQuestions || []) {
    if (q?.id) questionMap.set(q.id, q);
  }

  let evalItems: { id: string; points: number }[] = [];
  if (Array.isArray(packageQuestions) && packageQuestions.length > 0) {
    evalItems = packageQuestions.map((pq: any) => {
      const master = questionMap.get(pq.id);
      return {
        id: pq.id,
        points: getQuestionWeight(master, pq, exam),
      };
    });
  } else if (Array.isArray(session.questionIds) && session.questionIds.length > 0) {
    evalItems = session.questionIds.map((qId: string) => {
      const master = questionMap.get(qId);
      return {
        id: qId,
        points: getQuestionWeight(master, null, exam),
      };
    });
  }

  const evalIdsSet = new Set(evalItems.map((i) => i.id));
  for (const ansQid of Object.keys(answers)) {
    if (!evalIdsSet.has(ansQid)) {
      const master = questionMap.get(ansQid);
      evalItems.push({
        id: ansQid,
        points: getQuestionWeight(master, null, exam),
      });
      evalIdsSet.add(ansQid);
    }
  }

  const useMinusSystem = Boolean(exam?.scoringConfig?.useMinusSystem);
  const minusValue = useMinusSystem ? Math.abs(Number(exam?.scoringConfig?.minusValue) || 0) : 0;
  const pgKompleksMode = exam?.scoringConfig?.pgKompleksMode === 'exact' ? 'exact' : 'partial';

  let totalPointsEarned = 0;
  let correctCount = 0;

  for (const item of evalItems) {
    const master = questionMap.get(item.id);
    if (!master) continue;
    const studentAns = answers[item.id];
    const isUnanswered =
      studentAns === undefined ||
      studentAns === null ||
      studentAns === '' ||
      (Array.isArray(studentAns) && studentAns.length === 0);

    if (isUnanswered) {
      continue;
    }

    const points = item.points;

    if (master.type === 'pg') {
      if (String(studentAns).trim().toUpperCase() === String(master.correctAnswer).trim().toUpperCase()) {
        totalPointsEarned += points;
        correctCount++;
      } else if (useMinusSystem) {
        totalPointsEarned -= minusValue;
      }
    } else if (master.type === 'pg_kompleks') {
      const correctArr = Array.isArray(master.correctAnswer)
        ? Array.from(new Set(master.correctAnswer.map(String))).sort()
        : [];
      const studentArr = Array.isArray(studentAns)
        ? Array.from(new Set(studentAns.map(String))).sort()
        : [];
      if (correctArr.length > 0 && JSON.stringify(correctArr) === JSON.stringify(studentArr)) {
        totalPointsEarned += points;
        correctCount++;
      } else if (pgKompleksMode === 'exact') {
        if (useMinusSystem) {
          totalPointsEarned -= minusValue;
        }
      } else if (correctArr.length > 0) {
        const matches = studentArr.filter((val: string) => correctArr.includes(val)).length;
        const wrongSelected = studentArr.length - matches;
        const partialPoints = matches > 0 ? (matches / correctArr.length) * points : 0;
        const penalty = useMinusSystem ? wrongSelected * minusValue : 0;
        totalPointsEarned += Number((partialPoints - penalty).toFixed(4));
      }
    } else if (master.type === 'benar_salah') {
      if (String(studentAns) === String(master.correctAnswer)) {
        totalPointsEarned += points;
        correctCount++;
      } else if (useMinusSystem) {
        totalPointsEarned -= minusValue;
      }
    } else if (master.type === 'esai') {
      totalPointsEarned += Math.round(points * 0.8);
    }
  }

  const targetTotalQuestions = Number(exam?.cognitiveTarget?.totalQuestions) || 0;
  let maxPossiblePoints = 0;

  if (
    (Array.isArray(packageQuestions) && packageQuestions.length > 0) ||
    (Array.isArray(session.questionIds) && session.questionIds.length > 0)
  ) {
    maxPossiblePoints = evalItems.reduce((sum, item) => sum + item.points, 0);
  } else if (exam?.scoringConfig?.weights && exam?.cognitiveTarget) {
    const w = exam.scoringConfig.weights;
    const t = exam.cognitiveTarget;
    maxPossiblePoints =
      (Number(t.lotsCount) || 0) * (Number(w.LOTS) || 0) +
      (Number(t.motsCount) || 0) * (Number(w.MOTS) || 0) +
      (Number(t.hotsCount) || 0) * (Number(w.HOTS) || 0);
  } else {
    const knownPointsSum = evalItems.reduce((sum, item) => sum + item.points, 0);
    const avgPoints = evalItems.length > 0 ? knownPointsSum / evalItems.length : 10;
    const effectiveCount = Math.max(targetTotalQuestions, evalItems.length, 1);
    maxPossiblePoints = avgPoints * effectiveCount;
  }

  const maxScore = Number(exam?.maxScore) || 100;
  const liveScore =
    maxPossiblePoints > 0
      ? Math.min(maxScore, Math.round((totalPointsEarned / maxPossiblePoints) * maxScore))
      : 0;

  return {
    liveScore,
    liveCorrectCount: correctCount,
    isFinal: false,
  };
}
