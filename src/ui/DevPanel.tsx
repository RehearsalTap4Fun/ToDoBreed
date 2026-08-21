export function DevPanel({
  offset,
  onFeed,
  onShiftDays,
  onResetOffset,
  onResetSave,
}: {
  offset: number
  onFeed: (pts: number) => void
  onShiftDays: (n: number) => void
  onResetOffset: () => void
  onResetSave: () => void
}) {
  return (
    <div className="devpanel">
      <span className="dev-label">DEV · 时间偏移 {offset} 天</span>
      <button onClick={() => onFeed(12)}>+12点</button>
      <button onClick={() => onFeed(50)}>+50点</button>
      <button onClick={() => onShiftDays(1)}>+1天</button>
      <button onClick={() => onShiftDays(7)}>+7天</button>
      <button onClick={onResetOffset}>偏移清零</button>
      <button onClick={onResetSave}>重置存档</button>
    </div>
  )
}
