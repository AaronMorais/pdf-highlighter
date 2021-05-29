import * as React from "react"
import {useState} from "react"

import Button from 'react-bootstrap/Button'
import * as pdfjsLib from 'pdfjs-dist'
import { PDFDocument, rgb } from 'pdf-lib'
import download from 'downloadjs'

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.js`;

// styles
const pageStyles = {
  color: "#232129",
  fontFamily: "-apple-system, Roboto, sans-serif, serif",
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  height: '100vh',
}
const headingStyles = {
  marginTop: 12,
  marginBottom: 36,
  display: 'flex',
  width: '100%',
  justifyContent: 'center',
  alignItems: 'center',
}

const mainContainerStyles = {
  display: 'flex',
  width: '100%',
  height: '100%',
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
}
const optionMenuStyles = {
  display: 'flex',
  maxWidth: '400px',
  height: '100%',
  flexDirection: 'column',
  marginLeft: 8,
  marginRight: 32,
}

const menuItemStyles = {
  marginBottom: 24,
  fontWeight: 'bold',
}

const menuItemHeaderStyles = {
  fontWeight: 'bold',
  marginBottom: 6,
}

const menuItemContextStyles = {
  fontWeight: 'bold',
  marginLeft: 6,
  marginBottom: 6,
}

const phraseInputStyles = {
  width: '100%',
}

const phraseContextInputStyles = {
  maxWidth: 60,
}

const updateButtonStyles = {
  marginTop: 24,
  height: 40,
}

const pagesToRemove = (numPages, pages, contextBefore, contextAfter) => {
  let pagesSet = new Set(pages);
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    for (let j = (-1 * contextBefore); j < contextAfter + 1; j++) {
      const contextPage = page + j;
      pagesSet.add(contextPage);
    }
  }

  var result = [];
  for (var i = numPages - 1; i >= 0; i--) {
    if (!(pagesSet.has(i))) {
      result.push(i);
    }
  }
  return result;
}

const IndexPage = () => {
  const [file, setFile] = useState(null);
  const [phrases, setPhrases] = useState([]);
  const [shouldHighlightPhrases, setShouldHighlightPhrases] = useState(true);
  const [onlyShowPhrasePages, setOnlyShowPhrasePages] = useState(true);
  const [phrasePageContextBefore, setPhrasePageContextBefore] = useState(1);
  const [phrasePageContextAfter, setPhrasePageContextAfter] = useState(1);
  const [processing, setProcessing] = useState(false);

  const onFileSelection = (event) => {
    setFile(event.target.files[0]);
  }

  const onPhrasesChange = (event) => {
    setPhrases(event.target.value.split(',').map((phrase) => phrase.trim().toLowerCase()))
  }

  const onShouldHighlightPhrasesChange = (event) => {
    setShouldHighlightPhrases(event.target.checked)
  }

  const onShouldOnlyShowPhrasePagesChange = (event) => {
    setOnlyShowPhrasePages(event.target.checked)
  }

  const onPhrasePageContextBeforeChange = (event) => {
    setPhrasePageContextBefore(event.target.value)
  }

  const onPhrasePageContextAfterChange = (event) => {
    setPhrasePageContextAfter(event.target.value)
  }

  const onSubmit = () => {
    console.log(`Processing started`);
    const start = Date.now();
    setProcessing(true)
    const fileReader = new FileReader();
    fileReader.readAsArrayBuffer(file);
    fileReader.onload = function() {
      let document = pdfjsLib.getDocument({data: fileReader.result});
      document.promise.then((pdf) => {
        let pageFetchPromises = []
        const numPages = pdf.numPages;
        for (let i = 1; i <= numPages; i++) {
          pageFetchPromises.push(pdf.getPage(i));
        }
        
        Promise.all(pageFetchPromises).then((pages) => {
          return Promise.all(pages.map((page) => page.getTextContent()))
        }).then((pageTextContent) => {
          let pagesWithContent = []
          let elementsToHighlight = {}
          for (let i = 0; i < pageTextContent.length; i++) {
            const content = pageTextContent[i];
            if (!('items' in content)) {
              continue;
            }
            if (onlyShowPhrasePages) {
              const text = pageTextContent[i]['items'].map((c) => c.str).join('').toLowerCase();
              for (let j = 0; j < phrases.length; j++) {
                if (phrases[j].length > 0 && text.includes(phrases[j])) {
                  pagesWithContent.push(i)
                  break;
                }
              }
            }
            if (shouldHighlightPhrases) {
              pageTextContent[i]['items'].map((item) => {
                for (let j = 0; j < phrases.length; j++) {
                  if (phrases[j].length > 0 && item.str.toLowerCase().includes(phrases[j].toLowerCase())) {
                    if (!(i in elementsToHighlight)) {
                      elementsToHighlight[i] = [];
                    }
                    elementsToHighlight[i].push([phrases[j], item]);
                  }
                }
              });
            }
          }

          PDFDocument.load(fileReader.result).then((pdfLoadedDocument) => {
            if (onlyShowPhrasePages) {
              const toRemove = pagesToRemove(numPages, pagesWithContent, phrasePageContextBefore, phrasePageContextAfter);
              for (let i = 0; i < toRemove.length; i++) {
                pdfLoadedDocument.removePage(toRemove[i]);
              }
            }
            console.log(elementsToHighlight);
            if (shouldHighlightPhrases) {
              const keys = Object.keys(elementsToHighlight);
              for (let i = 0; i < keys.length; i++) {
                const pageNumber = parseInt(keys[i]);
                const page = pdfLoadedDocument.getPage(parseInt(keys[i]))
                for (let j = 0; j < elementsToHighlight[pageNumber].length; j++) {
                  const phrase = elementsToHighlight[pageNumber][j][0]
                  const transform = elementsToHighlight[pageNumber][j][1].transform
                  const height = elementsToHighlight[pageNumber][j][1].height

                  const elementLength = elementsToHighlight[pageNumber][j][1].str.length
                  const elementUnit = elementsToHighlight[pageNumber][j][1].width / elementLength
                  const phraseStartIndex = elementsToHighlight[pageNumber][j][1].str.toLowerCase().search(phrase.toLowerCase())
                  const phraseEndIndex = phrase.length + phraseStartIndex

                  const leftOffset = phraseStartIndex * elementUnit
                  const rightOffset = (elementLength - phraseEndIndex) * elementUnit
                  const width = elementsToHighlight[pageNumber][j][1].width - leftOffset - rightOffset
                  
                  page.drawRectangle({
                    x: transform[4] + leftOffset,
                    y: transform[5],
                    height: height,
                    width: width,
                    color: rgb(1, 1, 0),
                    opacity: 0.5,
                  })
                }
              }
            }
            pdfLoadedDocument.save().then((pdfResult) => {
              download(pdfResult, 'processed_' + file.name, "application/pdf");
              setProcessing(false);
              console.log(`Processing complete!`);
              console.log(`Processing took ${Math.floor((Date.now() - start) / 1000)} seconds`);
            })
          });
        })
      })
    };
  }

  return (
    <main style={pageStyles}>
      <title>PDF Highlight</title>
      <h1 style={headingStyles}><span>PDF Highlight</span></h1>
      <div style={mainContainerStyles}>
        <div style={optionMenuStyles}>
          <div style={menuItemStyles}>
            <div style={menuItemHeaderStyles}>Select PDF</div>
            <input type="file" onChange={onFileSelection} />
          </div>
          <div style={menuItemStyles}>
            <div style={menuItemHeaderStyles}>Phrases</div>
            <textarea onChange={onPhrasesChange} style={phraseInputStyles} placeholder={"Comma separated phrases\nie. 'source water, geological, landfill'"}/>
          </div>
          <div style={menuItemStyles}>
            <input type="checkbox" defaultChecked={true} onChange={onShouldHighlightPhrasesChange} />
            <span style={menuItemContextStyles}>Highlight phrases</span>
          </div>
          <div>
            <input type="checkbox" defaultChecked={true} onChange={onShouldOnlyShowPhrasePagesChange} />
            <span style={menuItemContextStyles}>Only include pages with phrases</span>
          </div>
          {onlyShowPhrasePages && 
            <>
              <div>
                <input style={phraseContextInputStyles} type="number" min={0} value={phrasePageContextBefore} onChange={onPhrasePageContextBeforeChange} />
                <span style={menuItemContextStyles}>page(s) before</span>
              </div>
              <div>
                <input style={phraseContextInputStyles} type="number" min={0} value={phrasePageContextAfter} onChange={onPhrasePageContextAfterChange} />
                <span style={menuItemContextStyles}>page(s) after</span>
              </div>
            </>
          }
          <Button style={updateButtonStyles} variant="primary" disabled={processing || file === null} onClick={onSubmit}>
            {processing ? 'Loading...' : 'Submit'} 
          </Button>
        </div>
      </div>
    </main>
  )
}

export default IndexPage
