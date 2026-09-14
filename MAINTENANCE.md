# 发布与维护

## 先单独建立本项目仓库

当前上层 `D:\card` 已是其他项目共用且有未提交改动的 Git 仓库。不要在上层目录执行 `git add .`。首次发布时，只在本目录建立独立仓库：

```powershell
cd D:\card\mvu\generic-mvu
git init
git branch -M main
git add .
git status
git commit -m "chore: publish generic MVU framework"
```

`.gitignore` 会排除依赖、构建包、预览和截图；它们不进入源码提交。确认 `git status` 只包含本框架的源代码、文档、配置和测试后，再提交。

## 首次推送到 GitHub

1. 登录 GitHub，创建一个空仓库，例如 `generic-mvu`。
2. 不要勾选 README、许可证或 `.gitignore` 初始化选项，避免首次推送产生无关的合并。
3. 在本目录运行，把地址替换为 GitHub 页面提供的 HTTPS 地址：

```powershell
git remote add origin https://github.com/<你的账号>/generic-mvu.git
git push -u origin main
```

GitHub 要求验证身份时，按网页提示使用浏览器登录或个人访问令牌；不要把令牌写入项目文件、提交记录或聊天消息。

## 日常维护

每次修改先确认范围：

```powershell
cd D:\card\mvu\generic-mvu
git status
```

作者功能只改 `src/author/` 与 `mvu.config.json`；修改框架时再同时更新测试和相关文档。提交前运行：

```powershell
npm test
npm run build
npm run preview:fixture
python <tavern-mmd目录>/scripts/validate.py output/mvu-regex.json --platform mmdsandbox
```

确认验证通过后，按本次实际改动精确暂存：

```powershell
git add src/author mvu.config.json README.md AUTHORING.md API.md AI_WORKFLOW.md main.md plan.md tests
git commit -m "feat: 简短说明本次改动"
git push
```

若本次修改了框架，也把 `src/framework`、`src/plugins`、`scripts` 和对应测试加入 `git add`。不要提交真实 MMD 账号资料、个人访问令牌、私密角色设定、聊天记录或 `.env` 文件。

## 发布版本

通过全部验证后，为可复现版本创建标签：

`package.json` 的 `version` 必须先改成与标签相同的版本号，再重新运行验证并提交版本号变更。

```powershell
git tag -a v1.0.0 -m "v1.0.0"
git push origin v1.0.0
```

在 GitHub 的 **Releases** 页面从该标签创建 Release，并上传刚构建的：

- `output/mvu-regex.json`
- `output/mvu-persona.txt`

版本号采用 `v主版本.次版本.修订版本`：破坏既有作者接口时升主版本；新增不破坏既有接口的功能时升次版本；只修复问题时升修订版本。

## 出错时

先查看提交记录和某次改动：

```powershell
git log --oneline
git show <提交ID>
```

已推送的错误不要改写共享历史，用新的反向提交恢复：

```powershell
git revert <提交ID>
git push
```

不要对已发布版本使用 `git reset --hard`。
