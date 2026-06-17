//! 업무 런처 도구 정의 — 순수 로직(파싱·조립·뷰 변환).
//! 부수효과(spawn/kill/tcp/browser)는 main.rs가 담당한다.
use serde::{Deserialize, Serialize};

/// tools.json의 도구 한 개.
#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct Tool {
    pub id: String,
    pub label: String,
    pub cwd: String,
    pub command: String,
    pub args: Vec<String>,
    pub port: u16,
    pub url: String,
}

/// 프런트로 보낼 최소 정보(실행 명령은 숨긴다).
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct ToolView {
    pub id: String,
    pub label: String,
    pub port: u16,
    pub url: String,
}

/// 실행에 필요한 조립된 커맨드.
#[derive(Debug, Clone, PartialEq)]
pub struct CommandSpec {
    pub program: String,
    pub args: Vec<String>,
    pub cwd: String,
}

impl Tool {
    pub fn to_view(&self) -> ToolView {
        ToolView {
            id: self.id.clone(),
            label: self.label.clone(),
            port: self.port,
            url: self.url.clone(),
        }
    }
}

pub fn build_command(tool: &Tool) -> CommandSpec {
    CommandSpec {
        program: tool.command.clone(),
        args: tool.args.clone(),
        cwd: tool.cwd.clone(),
    }
}

/// tools.json 본문 → 도구 목록. 선행 BOM 허용.
pub fn parse_tools(raw: &str) -> Result<Vec<Tool>, serde_json::Error> {
    serde_json::from_str(raw.trim_start_matches('\u{feff}'))
}

/// 파일이 없을 때 생성할 기본 시드 — 빈 목록.
/// 개인 경로/도구를 빌드에 굽지 않기 위해 비워 둔다. 사용자가 각자
/// `~/.todak/tools.json`에 자기 도구를 추가한다(형식은 README 참고).
pub const SEED_TOOLS_JSON: &str = "[]\n";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_a_basic_tool() {
        let raw = r#"[{"id":"x","label":"엑스","cwd":"C:/tmp","command":"streamlit","args":["run","app.py"],"port":8503,"url":"http://localhost:8503/"}]"#;
        let tools = parse_tools(raw).unwrap();
        assert_eq!(tools.len(), 1);
        assert_eq!(tools[0].id, "x");
        assert_eq!(tools[0].port, 8503);
        assert_eq!(tools[0].args, vec!["run", "app.py"]);
    }

    #[test]
    fn parses_empty_array() {
        assert_eq!(parse_tools("[]").unwrap().len(), 0);
    }

    #[test]
    fn rejects_broken_json() {
        assert!(parse_tools("{ not json").is_err());
    }

    #[test]
    fn tolerates_leading_bom() {
        assert_eq!(parse_tools("\u{feff}[]").unwrap().len(), 0);
    }

    // 테스트용 샘플 도구(개인 정보 없는 중립 경로).
    const SAMPLE_TOOL_JSON: &str = r#"[{"id":"sample","label":"샘플 앱","cwd":"C:\\tmp\\sample","command":"streamlit","args":["run","app.py","--server.port","8600"],"port":8600,"url":"http://localhost:8600/"}]"#;

    #[test]
    fn seed_is_empty() {
        // 공개 빌드에 개인 도구가 구워지지 않도록 시드는 빈 목록이어야 한다.
        assert!(parse_tools(SEED_TOOLS_JSON).unwrap().is_empty());
    }

    #[test]
    fn build_command_copies_fields() {
        let t = parse_tools(SAMPLE_TOOL_JSON).unwrap().remove(0);
        let spec = build_command(&t);
        assert_eq!(spec.program, "streamlit");
        assert_eq!(spec.args[0], "run");
        assert_eq!(spec.cwd, "C:\\tmp\\sample");
    }

    #[test]
    fn to_view_keeps_display_fields() {
        let t = parse_tools(SAMPLE_TOOL_JSON).unwrap().remove(0);
        let v = t.to_view();
        assert_eq!(v.id, "sample");
        assert_eq!(v.label, "샘플 앱");
        assert_eq!(v.port, 8600);
        assert_eq!(v.url, "http://localhost:8600/");
    }
}
