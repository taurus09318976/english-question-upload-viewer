class QuillEnglishQuestionViewer {
    constructor() {
        this.currentData = null;
        this.quillInstances = new Map(); // annotationId -> Quill 인스턴스
        this.uploadedFiles = new Map(); // 파일명 -> 파일 객체 매핑
        this.currentFileName = null;
        this.editingAnnotationId = null;
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // 파일 업로드 영역 클릭 이벤트
        document.getElementById('uploadArea').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });

        // 파일 선택 이벤트
        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files);
        });

        // 드래그 앤 드롭 이벤트
        const uploadArea = document.getElementById('uploadArea');
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            this.handleFileSelect(e.dataTransfer.files);
        });

        // 검색 이벤트
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filterFiles(e.target.value);
        });

        // 탭 전환 이벤트
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // 저장/취소 버튼 이벤트 (이벤트 위임 사용)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('save-edit-btn')) {
                e.preventDefault();
                e.stopPropagation();
                const idRaw = e.target.dataset.annotationId;
                const annotationId = Number(idRaw);
                if (!Number.isNaN(annotationId)) {
                    this.saveAnnotationEdit(annotationId);
                }
            }
            if (e.target.classList.contains('cancel-edit-btn')) {
                e.preventDefault();
                e.stopPropagation();
                const idRaw = e.target.dataset.annotationId;
                const annotationId = Number(idRaw);
                if (!Number.isNaN(annotationId)) {
                    this.cancelAnnotationEdit(annotationId);
                }
            }
        });
    }

    // 파일 선택 처리
    handleFileSelect(files) {
        Array.from(files).forEach(file => {
            if (file.type === 'application/json' || file.name.endsWith('.json')) {
                this.processFile(file);
            } else {
                alert(`${file.name}은(는) 지원되지 않는 파일 형식입니다. JSON 파일만 업로드 가능합니다.`);
            }
        });
    }

    // 파일 처리
    processFile(file) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const jsonData = JSON.parse(e.target.result);
                this.uploadedFiles.set(file.name, {
                    file: file,
                    data: jsonData
                });
                
                this.updateFileList();
                this.showSuccess(`파일 "${file.name}"이(가) 성공적으로 업로드되었습니다.`);
                
                // 첫 번째 파일이면 자동으로 선택
                if (this.uploadedFiles.size === 1) {
                    this.selectFile(file.name);
                }
                
            } catch (error) {
                console.error('JSON 파싱 오류:', error);
                this.showError(`파일 "${file.name}"의 JSON 형식이 올바르지 않습니다.`);
            }
        };
        
        reader.onerror = () => {
            this.showError(`파일 "${file.name}"을(를) 읽는 중 오류가 발생했습니다.`);
        };
        
        reader.readAsText(file);
    }

    // 파일 목록 업데이트
    updateFileList() {
        const fileListContainer = document.getElementById('fileList');
        fileListContainer.innerHTML = '';

        if (this.uploadedFiles.size === 0) {
            fileListContainer.innerHTML = `
                <div class="empty-state">
                    <h3>업로드된 파일이 없습니다</h3>
                    <p>위에서 JSON 파일을 업로드해주세요.</p>
                </div>
            `;
            return;
        }

        this.uploadedFiles.forEach((fileInfo, fileName) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.dataset.fileName = fileName;
            
            // 파일명 표시 포맷팅
            const displayName = fileName.length > 20 ? fileName.substring(0, 20) + '...' : fileName;
            
            fileItem.innerHTML = `
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: #333;">${displayName}</div>
                    <div style="font-size: 0.85rem; color: #666;">${fileName}</div>
                </div>
                <div style="color: #667eea;">📄</div>
            `;

            fileItem.addEventListener('click', () => {
                this.selectFile(fileName);
            });

            fileListContainer.appendChild(fileItem);
        });
    }

    // 파일 검색 필터링
    filterFiles(searchTerm) {
        const fileItems = document.querySelectorAll('.file-item');
        
        fileItems.forEach(item => {
            const fileName = item.dataset.fileName;
            if (!searchTerm.trim() || fileName.toLowerCase().includes(searchTerm.toLowerCase())) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    // 파일 선택
    selectFile(fileName) {
        try {
            // 이전 활성 파일 비활성화
            document.querySelectorAll('.file-item').forEach(item => {
                item.classList.remove('active');
            });

            // 현재 파일 활성화
            const selectedItem = document.querySelector(`[data-file-name="${fileName}"]`);
            if (selectedItem) {
                selectedItem.classList.add('active');
            }

            // 로딩 상태 표시
            this.showLoading();

            const fileInfo = this.uploadedFiles.get(fileName);
            if (!fileInfo) {
                throw new Error('파일 정보를 찾을 수 없습니다.');
            }

            this.currentData = fileInfo.data;
            this.currentFileName = fileName;

            // UI 업데이트
            this.updateFileInfo(fileName, fileInfo.data);
            this.displayQuestions(fileInfo.data);
            this.displayRawJson(fileInfo.data);
            this.displayHtmlContent(fileInfo.data);

            // 내보내기 버튼 활성화
            document.getElementById('exportBtn').disabled = false;

        } catch (error) {
            console.error('파일 로드 오류:', error);
            this.showError(`파일을 불러오는 중 오류가 발생했습니다: ${error.message}`);
        }
    }

    // 성공 메시지 표시
    showSuccess(message) {
        // 토스트 메시지 생성
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            font-weight: 500;
            animation: slideIn 0.3s ease;
        `;
        toast.textContent = message;
        
        // CSS 애니메이션 추가
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(toast);
        
        // 3초 후 제거
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
        
        // 콘솔에도 출력
        console.log('Success:', message);
    }

    // 로딩 상태 표시
    showLoading() {
        const questionsTab = document.getElementById('questionsTab');
        questionsTab.innerHTML = '<div class="loading">파일을 불러오는 중...</div>';
    }

    // 오류 메시지 표시
    showError(message) {
        // 토스트 메시지 생성
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #dc3545;
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            font-weight: 500;
            animation: slideIn 0.3s ease;
            max-width: 400px;
        `;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // 5초 후 제거
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 5000);
        
        // 콘솔에도 출력
        console.error('Error:', message);
    }

    // 파일 정보 업데이트
    updateFileInfo(fileName, data) {
        document.getElementById('currentFileName').textContent = fileName;
        
        let metaInfo = '';
        const itemCount = data.items ? data.items.length : 0;
        const annotationCount = data.annotations ? data.annotations.length : 0;
        const imageCount = data.images ? data.images.length : 0;
        
        metaInfo = `문항 수: ${itemCount}개 | 주석 수: ${annotationCount}개 | 페이지 수: ${imageCount}개`;
        if (data.info && data.info.provider) {
            metaInfo += ` | 제공자: ${data.info.provider}`;
        }
        
        document.getElementById('fileMeta').textContent = metaInfo;
    }

    // 문항 표시
    displayQuestions(data) {
        const questionsTab = document.getElementById('questionsTab');
        
        if (!data.items || data.items.length === 0) {
            questionsTab.innerHTML = `
                <div class="empty-state">
                    <h3>문항이 없습니다</h3>
                    <p>이 파일에는 표시할 문항이 없습니다.</p>
                </div>
            `;
            return;
        }

        questionsTab.innerHTML = '';

        data.items.forEach((item, index) => {
            const questionContainer = document.createElement('div');
            questionContainer.className = 'question-container';
            
            const questionHeader = document.createElement('div');
            questionHeader.className = 'question-header';
            
            // 이미지 정보 가져오기
            const imageInfo = this.getImageInfo(item.imageIds, data.images);
            
            // 이미지 정보 HTML 생성
            const imageInfoHtml = imageInfo.length > 0 
                ? `<div style="margin-top: 5px; font-size: 0.85rem; color: #666; background: #f0f4ff; padding: 5px; border-radius: 3px;">
                    📄 ${imageInfo.map(img => img.file_name).join(', ')}
                   </div>`
                : `<div style="margin-top: 5px; font-size: 0.85rem; color: #999; background: #f8f8f8; padding: 5px; border-radius: 3px;">
                    📄 이미지 정보 없음
                   </div>`;
            
            questionHeader.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                    <span class="question-number">문항 ${item.id || index + 1}</span>
                    <span class="question-type">${item.answerType || 'Unknown'}</span>
                </div>
                ${imageInfoHtml}
            `;
            
            questionContainer.appendChild(questionHeader);

            // 지문 영역 (Passage)
            if (item.passageAreaInfo && item.passageAreaInfo.annotationIds.length > 0) {
                const passageSection = this.createQuestionSection('지문', item.passageAreaInfo.annotationIds, data.annotations);
                if (passageSection) questionContainer.appendChild(passageSection);
            }

            // 문제 영역 (Question)
            if (item.questionAreaInfo && item.questionAreaInfo.annotationIds.length > 0) {
                const questionSection = this.createQuestionSection('문제', item.questionAreaInfo.annotationIds, data.annotations);
                if (questionSection) questionContainer.appendChild(questionSection);
            }

            // 답안 영역 (Answer)
            if (item.answerAreaInfo && item.answerAreaInfo.annotationIds.length > 0) {
                const answerSection = this.createQuestionSection('답안', item.answerAreaInfo.annotationIds, data.annotations);
                if (answerSection) questionContainer.appendChild(answerSection);
            }

            // 해설 영역 (Explanation)
            if (item.explanationAreaInfo && item.explanationAreaInfo.annotationIds.length > 0) {
                const explanationSection = this.createQuestionSection('해설', item.explanationAreaInfo.annotationIds, data.annotations);
                if (explanationSection) questionContainer.appendChild(explanationSection);
            }

            questionsTab.appendChild(questionContainer);
        });
    }

    // 문항 섹션 생성
    createQuestionSection(title, annotationIds, annotations) {
        const section = document.createElement('div');
        section.className = 'question-section';
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'section-title';
        titleDiv.textContent = title;
        section.appendChild(titleDiv);

        let hasContent = false;

        annotationIds.forEach(annotationId => {
            const annotation = this.findAnnotation(annotationId, annotations);
            if (annotation) {
                const contentDiv = this.createAnnotationContent(annotation, title, annotationId);
                if (contentDiv) {
                    section.appendChild(contentDiv);
                    hasContent = true;
                }
            }
        });

        return hasContent ? section : null;
    }

    // Annotation 찾기
    findAnnotation(annotationId, annotations) {
        if (!annotations) return null;
        return annotations.find(ann => ann.id === annotationId);
    }

    // 이미지 정보 가져오기
    getImageInfo(imageIds, images) {
        if (!imageIds || !images || imageIds.length === 0) {
            return [];
        }
        
        const result = imageIds.map(imageId => {
            const image = images.find(img => img.id === imageId);
            return image || null;
        }).filter(img => img !== null);
        
        return result;
    }

    // Annotation 콘텐츠 생성 (Quill.js 편집 기능 포함)
    createAnnotationContent(annotation, sectionTitle, annotationId) {
        const contentDiv = document.createElement('div');
        contentDiv.className = 'annotation-content';
        contentDiv.style.marginBottom = '15px';
        contentDiv.style.padding = '15px';
        contentDiv.style.background = '#fafafa';
        contentDiv.style.border = '1px solid #e9ecef';
        contentDiv.style.borderRadius = '6px';

        // 편집 버튼 추가
        const editButton = document.createElement('button');
        editButton.className = 'edit-btn';
        editButton.textContent = '✏️ 편집';
        editButton.style.cssText = `
            float: right;
            background: #667eea;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.8rem;
            margin-bottom: 10px;
        `;
        editButton.addEventListener('click', () => {
            this.startAnnotationEdit(annotationId);
        });

        // 메타 정보
        const metaDiv = document.createElement('div');
        metaDiv.style.cssText = 'font-size: 0.85rem; color: #666; margin-bottom: 8px;';
        metaDiv.innerHTML = `
            ID: ${annotation.id} | 카테고리: ${annotation.category_id || 'N/A'}
        `;
        metaDiv.appendChild(editButton);

        contentDiv.appendChild(metaDiv);

        // 콘텐츠 영역
        const contentArea = document.createElement('div');
        contentArea.id = `content-${annotationId}`;
        contentArea.className = 'annotation-text-content';

        // HTML이 있으면 HTML을 사용, 없으면 텍스트 사용
        if (annotation.html && annotation.html.trim()) {
            contentArea.innerHTML = this.sanitizeHtml(annotation.html);
        } else if (annotation.text && annotation.text.trim()) {
            const textContent = annotation.text.replace(/\n/g, '<br>');
            contentArea.innerHTML = `<div style="line-height: 1.6;">${textContent}</div>`;
        } else {
            contentArea.innerHTML = '<em style="color: #999;">내용이 없습니다</em>';
        }

        contentDiv.appendChild(contentArea);

        // Quill.js 에디터 컨테이너 (숨김)
        const editorContainer = document.createElement('div');
        editorContainer.id = `editor-${annotationId}`;
        editorContainer.className = 'quill-editor-container';
        editorContainer.style.display = 'none';
        editorContainer.style.marginTop = '10px';
        contentDiv.appendChild(editorContainer);

        // 편집 버튼들 (숨김)
        const editButtons = document.createElement('div');
        editButtons.id = `edit-buttons-${annotationId}`;
        editButtons.className = 'edit-buttons';
        editButtons.style.cssText = `
            display: none;
            margin-top: 10px;
            text-align: right;
        `;
        editButtons.innerHTML = `
            <button class="save-edit-btn" data-annotation-id="${annotationId}" style="background: #28a745; color: white; border: none; padding: 5px 15px; border-radius: 4px; cursor: pointer; margin-right: 5px;">저장</button>
            <button class="cancel-edit-btn" data-annotation-id="${annotationId}" style="background: #dc3545; color: white; border: none; padding: 5px 15px; border-radius: 4px; cursor: pointer;">취소</button>
        `;
        contentDiv.appendChild(editButtons);

        return contentDiv;
    }

    // Annotation 편집 시작
    startAnnotationEdit(annotationId) {
        // 이전 편집 중인 항목이 있으면 완전히 정리
        if (this.editingAnnotationId && this.editingAnnotationId !== annotationId) {
            this.finishAnnotationEdit(this.editingAnnotationId);
        }

        this.editingAnnotationId = annotationId;
        const annotation = this.findAnnotation(annotationId, this.currentData.annotations);
        if (!annotation) return;

        const contentArea = document.getElementById(`content-${annotationId}`);
        const editorContainer = document.getElementById(`editor-${annotationId}`);
        const editButtons = document.getElementById(`edit-buttons-${annotationId}`);

        if (!contentArea || !editorContainer || !editButtons) {
            console.error('필요한 DOM 요소를 찾을 수 없습니다:', annotationId);
            return;
        }

        // 콘텐츠 영역 숨기기
        contentArea.style.display = 'none';

        // 에디터 컨테이너 초기화 및 표시
        editorContainer.innerHTML = ''; // 기존 내용 완전 제거
        editorContainer.style.display = 'block';
        editButtons.style.display = 'block';

        // Quill.js 에디터 생성
        const quill = new Quill(editorContainer, {
            theme: 'snow',
            modules: {
                toolbar: [
                    ['bold', 'italic', 'underline'],
                    ['link'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['clean']
                ]
            },
            placeholder: '내용을 입력하세요...'
        });

        // 기존 HTML을 Delta로 변환하여 에디터에 로드
        const htmlContent = annotation.html || annotation.text || '';
        if (htmlContent) {
            try {
                const delta = this.htmlToDelta(htmlContent);
                quill.setContents(delta);
            } catch (error) {
                console.error('Delta 변환 오류:', error);
                // 폴백: 텍스트만 설정
                quill.setText(htmlContent);
            }
        }

        // Quill 인스턴스 저장
        this.quillInstances.set(annotationId, quill);
    }

    // Annotation 편집 저장
    saveAnnotationEdit(annotationId) {
        console.log('저장 시작:', annotationId);
        
        const quill = this.quillInstances.get(annotationId);
        if (!quill) {
            console.error('Quill 인스턴스를 찾을 수 없습니다:', annotationId);
            return;
        }

        const annotation = this.findAnnotation(annotationId, this.currentData.annotations);
        if (!annotation) {
            console.error('Annotation을 찾을 수 없습니다:', annotationId);
            return;
        }

        try {
            // Delta를 HTML로 변환
            const delta = quill.getContents();
            const htmlContent = this.deltaToHtml(delta);

            // annotation 업데이트
            annotation.html = htmlContent;
            annotation.text = this.htmlToText(htmlContent);

            // UI 업데이트
            this.updateAnnotationDisplay(annotationId, htmlContent);

            // 편집 모드 종료
            this.finishAnnotationEdit(annotationId);

            this.showSuccess(`Annotation ${annotationId}이(가) 저장되었습니다.`);
            console.log('저장 완료:', annotationId);
            
        } catch (error) {
            console.error('저장 중 오류 발생:', error);
            this.showError(`저장 중 오류가 발생했습니다: ${error.message}`);
        }
    }

    // Annotation 편집 취소
    cancelAnnotationEdit(annotationId) {
        this.finishAnnotationEdit(annotationId);
    }

    // Annotation 편집 완료
    finishAnnotationEdit(annotationId) {
        const contentArea = document.getElementById(`content-${annotationId}`);
        const editorContainer = document.getElementById(`editor-${annotationId}`);
        const editButtons = document.getElementById(`edit-buttons-${annotationId}`);

        // Quill 인스턴스 완전 제거
        const quill = this.quillInstances.get(annotationId);
        if (quill) {
            // Quill 인스턴스의 DOM 요소들 완전 제거
            const quillRoot = quill.root;
            if (quillRoot && quillRoot.parentNode) {
                quillRoot.parentNode.removeChild(quillRoot);
            }
            
            // 툴바 제거
            const toolbar = quill.getModule('toolbar');
            if (toolbar && toolbar.container && toolbar.container.parentNode) {
                toolbar.container.parentNode.removeChild(toolbar.container);
            }
            
            // 인스턴스 제거
            this.quillInstances.delete(annotationId);
        }

        // UI 복원
        if (contentArea) contentArea.style.display = 'block';
        if (editorContainer) {
            editorContainer.style.display = 'none';
            editorContainer.innerHTML = ''; // 컨테이너 내용 완전 비우기
        }
        if (editButtons) editButtons.style.display = 'none';

        this.editingAnnotationId = null;
    }

    // Annotation 표시 업데이트
    updateAnnotationDisplay(annotationId, htmlContent) {
        const contentArea = document.getElementById(`content-${annotationId}`);
        if (contentArea) {
            contentArea.innerHTML = this.sanitizeHtml(htmlContent);
        }
    }

    // HTML을 Delta로 변환 (렌더링 이슈 최소화)
    htmlToDelta(html) {
        try {
            // 임시 div 생성
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            
            // Quill.js의 clipboard 모듈을 사용하여 HTML을 Delta로 변환
            const clipboard = Quill.import('modules/clipboard');
            const delta = Quill.import('delta');
            
            // 임시 Quill 인스턴스 생성
            const tempQuill = new Quill(document.createElement('div'), {
                readOnly: true,
                modules: {
                    clipboard: {
                        matchers: [
                            ['div', (node, delta) => {
                                // div 태그 처리
                                return delta;
                            }],
                            ['span', (node, delta) => {
                                // span 태그 처리
                                return delta;
                            }],
                            ['p', (node, delta) => {
                                // p 태그 처리
                                return delta;
                            }],
                            ['br', (node, delta) => {
                                // br 태그 처리
                                return delta.compose(new delta().insert('\n'));
                            }],
                            ['strong', (node, delta) => {
                                // strong 태그 처리
                                return delta.compose(new delta().retain(delta.length(), { bold: true }));
                            }],
                            ['b', (node, delta) => {
                                // b 태그 처리
                                return delta.compose(new delta().retain(delta.length(), { bold: true }));
                            }],
                            ['em', (node, delta) => {
                                // em 태그 처리
                                return delta.compose(new delta().retain(delta.length(), { italic: true }));
                            }],
                            ['i', (node, delta) => {
                                // i 태그 처리
                                return delta.compose(new delta().retain(delta.length(), { italic: true }));
                            }],
                            ['u', (node, delta) => {
                                // u 태그 처리
                                return delta.compose(new delta().retain(delta.length(), { underline: true }));
                            }]
                        ]
                    }
                }
            });
            
            // HTML을 clipboard에 붙여넣기
            tempQuill.clipboard.dangerouslyPasteHTML(html);
            
            // Delta 반환
            return tempQuill.getContents();
            
        } catch (error) {
            console.error('HTML to Delta 변환 오류:', error);
            // 폴백: 텍스트만 추출
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            const text = tempDiv.textContent || tempDiv.innerText || '';
            return new Quill.import('delta')([{ insert: text }]);
        }
    }

    // Delta를 HTML로 변환 (렌더링 이슈 최소화)
    deltaToHtml(delta) {
        try {
            // 임시 Quill 인스턴스 생성
            const tempDiv = document.createElement('div');
            const quill = new Quill(tempDiv, { 
                readOnly: true,
                modules: {
                    toolbar: false
                }
            });
            
            // Delta 설정
            quill.setContents(delta);
            
            // HTML 추출 및 정리
            let html = quill.root.innerHTML;
            
            // 불필요한 태그 정리
            html = html.replace(/<p><br><\/p>/g, ''); // 빈 p 태그 제거
            html = html.replace(/<p><\/p>/g, ''); // 빈 p 태그 제거
            
            // 기존 스타일 클래스 보존
            if (html.includes('class="')) {
                // 기존 클래스가 있으면 유지
                return html;
            } else {
                // 기본 스타일링 적용
                return html.replace(/<p>/g, '<div>').replace(/<\/p>/g, '</div>');
            }
            
        } catch (error) {
            console.error('Delta to HTML 변환 오류:', error);
            // 폴백: 텍스트만 반환
            return delta.ops.map(op => {
                if (typeof op.insert === 'string') {
                    let text = op.insert;
                    if (op.attributes) {
                        if (op.attributes.bold) text = `<strong>${text}</strong>`;
                        if (op.attributes.italic) text = `<em>${text}</em>`;
                        if (op.attributes.underline) text = `<u>${text}</u>`;
                    }
                    return text;
                }
                return '';
            }).join('');
        }
    }

    // HTML을 텍스트로 변환
    htmlToText(html) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        return tempDiv.textContent || tempDiv.innerText || '';
    }

    // HTML 안전화
    sanitizeHtml(html) {
        // 기본적인 HTML 태그만 허용
        const allowedTags = ['div', 'span', 'p', 'br', 'strong', 'em', 'u', 'b', 'i', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        return tempDiv.innerHTML;
    }

    // 원본 JSON 표시
    displayRawJson(data) {
        const rawJson = document.getElementById('rawJson');
        rawJson.textContent = JSON.stringify(data, null, 2);
    }

    // HTML 콘텐츠 표시
    displayHtmlContent(data) {
        const htmlContent = document.getElementById('htmlContent');
        htmlContent.innerHTML = '';

        if (!data.items || data.items.length === 0) {
            htmlContent.innerHTML = '<p>HTML로 표시할 콘텐츠가 없습니다.</p>';
            return;
        }

        data.items.forEach((item, index) => {
            const questionDiv = document.createElement('div');
            questionDiv.style.marginBottom = '30px';
            questionDiv.style.border = '1px solid #ddd';
            questionDiv.style.borderRadius = '8px';
            questionDiv.style.padding = '20px';

            const titleH3 = document.createElement('h3');
            titleH3.textContent = `문항 ${item.id || index + 1}`;
            titleH3.style.color = '#667eea';
            titleH3.style.marginBottom = '10px';
            questionDiv.appendChild(titleH3);

            // 이미지 정보 추가
            const imageInfo = this.getImageInfo(item.imageIds, data.images);
            if (imageInfo.length > 0) {
                const imageInfoDiv = document.createElement('div');
                imageInfoDiv.style.fontSize = '0.9rem';
                imageInfoDiv.style.color = '#666';
                imageInfoDiv.style.marginBottom = '15px';
                imageInfoDiv.style.padding = '8px';
                imageInfoDiv.style.backgroundColor = '#f0f4ff';
                imageInfoDiv.style.borderLeft = '3px solid #667eea';
                imageInfoDiv.style.borderRadius = '3px';
                
                const imageList = imageInfo.map(img => {
                    const fileName = img.file_name;
                    const pageType = img.page_type || 'Unknown';
                    const dimensions = `${img.width}×${img.height}`;
                    return `📄 <strong>${fileName}</strong> (${pageType}, ${dimensions}px)`;
                }).join('<br>');
                
                imageInfoDiv.innerHTML = `
                    <strong>📁 원본 이미지:</strong><br>
                    ${imageList}
                `;
                questionDiv.appendChild(imageInfoDiv);
            }

            // 각 영역별로 처리
            const sections = [
                { title: '지문', ids: item.passageAreaInfo?.annotationIds || [] },
                { title: '문제', ids: item.questionAreaInfo?.annotationIds || [] },
                { title: '답안', ids: item.answerAreaInfo?.annotationIds || [] },
                { title: '해설', ids: item.explanationAreaInfo?.annotationIds || [] }
            ];

            sections.forEach(section => {
                if (section.ids.length > 0) {
                    const sectionDiv = document.createElement('div');
                    sectionDiv.style.marginBottom = '15px';

                    const sectionTitle = document.createElement('h4');
                    sectionTitle.textContent = section.title;
                    sectionTitle.style.color = '#333';
                    sectionTitle.style.marginBottom = '8px';
                    sectionDiv.appendChild(sectionTitle);

                    section.ids.forEach(annotationId => {
                        const annotation = this.findAnnotation(annotationId, data.annotations);
                        if (annotation) {
                            const contentDiv = document.createElement('div');
                            contentDiv.style.padding = '10px';
                            contentDiv.style.backgroundColor = '#f8f9fa';
                            contentDiv.style.borderRadius = '4px';
                            contentDiv.style.border = '1px solid #e9ecef';
                            contentDiv.style.marginBottom = '10px';

                            if (annotation.html && annotation.html.trim()) {
                                contentDiv.innerHTML = `
                                    <div style="font-size: 0.8rem; color: #666; margin-bottom: 5px;">
                                        Annotation ID: ${annotation.id}
                                    </div>
                                    ${this.sanitizeHtml(annotation.html)}
                                `;
                            } else if (annotation.text && annotation.text.trim()) {
                                const textContent = annotation.text.replace(/\n/g, '<br>');
                                contentDiv.innerHTML = `
                                    <div style="font-size: 0.8rem; color: #666; margin-bottom: 5px;">
                                        Annotation ID: ${annotation.id}
                                    </div>
                                    <div style="line-height: 1.6;">${textContent}</div>
                                `;
                            }

                            sectionDiv.appendChild(contentDiv);
                        }
                    });

                    if (sectionDiv.children.length > 1) {
                        questionDiv.appendChild(sectionDiv);
                    }
                }
            });

            htmlContent.appendChild(questionDiv);
        });
    }

    // 탭 전환
    switchTab(tabName) {
        // 탭 버튼 활성화 상태 변경
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // 탭 콘텐츠 표시/숨김
        document.querySelectorAll('.question-viewer').forEach(viewer => {
            viewer.classList.remove('active');
            viewer.style.display = 'none';
        });

        const activeTab = document.getElementById(`${tabName}Tab`);
        if (activeTab) {
            activeTab.classList.add('active');
            activeTab.style.display = 'block';
        }
    }

    // 수정된 JSON 내보내기
    exportModifiedJson() {
        if (!this.currentData) {
            this.showError('내보낼 데이터가 없습니다.');
            return;
        }

        const dataStr = JSON.stringify(this.currentData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `${this.currentFileName}_modified.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        this.showSuccess('수정된 JSON이 다운로드되었습니다.');
    }
}

// 인스턴스 생성은 HTML에서 수행합니다 (중복 생성 방지)
