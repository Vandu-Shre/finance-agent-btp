"""Tests for FinanceAgentSDK – top-level entry point."""

import pytest
from finance_agent_sdk import FinanceAgentSDK, FinanceAgentConfig, FileClient, ChatClient


@pytest.fixture
def config():
    return FinanceAgentConfig(base_url="https://example.com", auth_token="tok")


class TestFinanceAgentSDK:
    def test_creates_file_client(self, config):
        sdk = FinanceAgentSDK(config)
        assert isinstance(sdk.files, FileClient)

    def test_creates_chat_client(self, config):
        sdk = FinanceAgentSDK(config)
        assert isinstance(sdk.chat, ChatClient)

    def test_file_client_uses_config(self, config):
        sdk = FinanceAgentSDK(config)
        assert sdk.files._base_url == "https://example.com"
        assert sdk.files._headers["Authorization"] == "Bearer tok"

    def test_chat_client_uses_config(self, config):
        sdk = FinanceAgentSDK(config)
        assert sdk.chat._ws_url == "wss://example.com/api/chat"
        assert sdk.chat._auth_token == "tok"

    def test_file_and_chat_are_separate_instances(self, config):
        sdk = FinanceAgentSDK(config)
        assert sdk.files is not sdk.chat

    def test_two_sdks_have_independent_clients(self, config):
        sdk1 = FinanceAgentSDK(config)
        sdk2 = FinanceAgentSDK(config)
        assert sdk1.files is not sdk2.files
        assert sdk1.chat is not sdk2.chat

    def test_works_without_auth_token(self):
        cfg = FinanceAgentConfig(base_url="https://example.com")
        sdk = FinanceAgentSDK(cfg)
        assert sdk.chat._auth_token is None
        assert "Authorization" not in sdk.files._headers
