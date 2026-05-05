#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""Tests for the current HwpController interface."""

import os
import tempfile
from unittest.mock import MagicMock, patch

from src.tools.hwp_controller import HwpController


def _running_controller(mock_hwp=None):
    controller = HwpController()
    controller.hwp = mock_hwp or MagicMock()
    controller.is_hwp_running = True
    return controller


class TestHwpController:
    @patch("win32com.client.GetActiveObject", side_effect=Exception("not running"))
    @patch("win32com.client.Dispatch")
    def test_connect_dispatches_hwp_when_no_active_instance(self, mock_dispatch, _mock_get_active):
        mock_hwp = MagicMock()
        mock_dispatch.return_value = mock_hwp

        controller = HwpController()
        result = controller.connect(visible=False, register_security_module=False)

        assert result is True
        mock_dispatch.assert_called_once_with("HWPFrame.HwpObject")
        assert controller.hwp is mock_hwp
        assert controller.is_hwp_running is True

    def test_open_document_uses_hwp_file_open_action(self):
        mock_hwp = MagicMock()
        mock_hwp.HAction.Execute.return_value = True
        controller = _running_controller(mock_hwp)

        result = controller.open_document("test.hwp")

        assert result is True
        mock_hwp.HAction.GetDefault.assert_called_once()
        mock_hwp.HAction.Execute.assert_called_once()
        assert controller.current_document_path == os.path.abspath("test.hwp")

    def test_save_document_with_path_calls_save_as(self):
        mock_hwp = MagicMock()
        controller = _running_controller(mock_hwp)

        with tempfile.NamedTemporaryFile(suffix=".hwp", delete=False) as temp_file:
            temp_path = temp_file.name

        try:
            result = controller.save_document(temp_path)

            assert result is True
            mock_hwp.SaveAs.assert_called_once_with(os.path.abspath(temp_path), "HWP", "")
            assert controller.current_document_path == os.path.abspath(temp_path)
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    def test_get_text_reads_text_file(self):
        mock_hwp = MagicMock()
        mock_hwp.GetTextFile.return_value = "Test document content"
        controller = _running_controller(mock_hwp)

        result = controller.get_text()

        mock_hwp.GetTextFile.assert_called_once_with("TEXT", "")
        assert result == "Test document content"

    def test_insert_text_uses_insert_text_action(self):
        mock_hwp = MagicMock()
        controller = _running_controller(mock_hwp)

        result = controller.insert_text("Hello, World!")

        assert result is True
        mock_hwp.HAction.GetDefault.assert_called_once()
        assert mock_hwp.HParameterSet.HInsertText.Text == "Hello, World!"
        mock_hwp.HAction.Execute.assert_called_once()
