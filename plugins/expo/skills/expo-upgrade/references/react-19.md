# React 19

React 19 ships with Expo SDK 54. The API changes are standard React knowledge — apply them from memory; full details: https://react.dev/blog/2024/12/05/react-19

Upgrade checklist for SDK 54+ codebases:

- [ ] Replace `useContext(MyContext)` with `use(MyContext)` (also reads promises; may be called conditionally)
- [ ] Drop the `.Provider` suffix — render `<MyContext value={...}>` directly
- [ ] Remove `forwardRef` wrappers — accept `ref` as a regular prop (`ref?: React.Ref<T>`)
